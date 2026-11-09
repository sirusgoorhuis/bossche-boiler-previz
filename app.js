// Concept page: plays the recorded Previz clips and switches them like the TouchDesigner control panel

const CAMERAS = [
	{ key: 'overview', label: 'Overview' },
	{ key: 'front', label: 'Front' },
	{ key: 'frontleft', label: 'Front L' },
	{ key: 'frontright', label: 'Front R' },
	{ key: 'sideleft', label: 'Side L' },
	{ key: 'sideright', label: 'Side R' },
	{ key: 'back', label: 'Back' },
	{ key: 'top', label: 'Top' },
	{ key: 'undermirror', label: 'Under Mirror' },
	{ key: 'crowd', label: 'In Crowd' },
	{ key: 'projector', label: 'Projector' },
];

const LOOKS = [
	{ key: 'show', label: 'Show', note: 'Alle lichten aan, zoals op de avond zelf.' },
	{ key: 'projection', label: 'Projection Only', note: 'Alleen de projector. Zo zie je wat het effect met het publiek doet.' },
	{ key: 'worklight', label: 'Work Light', note: 'Zaallicht aan, om de opstelling zelf te zien.' },
];

const EFFECTS = [
	{ key: 'lavablobs', label: 'Lava Blobs', ready: true },
	{ key: 'slot2', label: 'Slot 2', ready: false },
	{ key: 'slot3', label: 'Slot 3', ready: false },
	{ key: 'slot4', label: 'Slot 4', ready: false },
];

const SYNC_TOLERANCE = 0.08;
const SVG_NS = 'http://www.w3.org/2000/svg';
const MARKER_RADIUS = 0.3;

const state = {
	camera: 'frontright',
	look: 'show',
	spin: false,
	pip: true,
	effect: 'lavablobs',
	spinSpeed: 1,
};

const mainVideo = document.getElementById('mainVideo');
const fxVideo = document.getElementById('fxVideo');
const pip = document.getElementById('pip');
const stage = document.getElementById('stage');
const stageLabel = document.getElementById('stageLabel');
const loading = document.getElementById('loading');
const spinButton = document.getElementById('btnSpin');
const pipButton = document.getElementById('btnPip');
const spinSpeed = document.getElementById('spinSpeed');
const lookNote = document.getElementById('lookNote');
const panelButtons = [];

/**
 * Builds a panel button and remembers how to tell whether it is pressed.
 * Settings object: { label, isPressed, isDisabled, title, onClick }
 */
function makeButton(settings) {
	const button = document.createElement('button');
	button.className = 'btn';
	button.textContent = settings.label;
	button.title = settings.title || settings.label;
	button.disabled = Boolean(settings.isDisabled);
	button.addEventListener('click', settings.onClick);
	panelButtons.push({ button, isPressed: settings.isPressed });
	return button;
}

function buildPanel() {
	const cameraGrid = document.getElementById('cameraButtons');
	CAMERAS.forEach((camera) => {
		cameraGrid.append(makeButton({
			label: camera.label,
			isPressed: () => !state.spin && state.camera === camera.key,
			onClick: () => setState({ camera: camera.key, spin: false }),
		}));
	});
	cameraGrid.append(makeButton({
		label: 'Fullscreen',
		title: 'Beeld schermvullend',
		isPressed: () => false,
		onClick: () => stage.requestFullscreen && stage.requestFullscreen(),
	}));

	const effectGrid = document.getElementById('effectButtons');
	EFFECTS.forEach((effect) => {
		effectGrid.append(makeButton({
			label: effect.label,
			title: effect.ready ? effect.label : 'Nog te bouwen',
			isDisabled: !effect.ready,
			isPressed: () => state.effect === effect.key,
			onClick: () => setState({ effect: effect.key }),
		}));
	});

	const lookGrid = document.getElementById('lookButtons');
	LOOKS.forEach((look) => {
		lookGrid.append(makeButton({
			label: look.label,
			isPressed: () => state.look === look.key,
			onClick: () => setState({ look: look.key }),
		}));
	});

	spinButton.addEventListener('click', () => setState({ spin: !state.spin }));
	pipButton.addEventListener('click', () => setState({ pip: !state.pip }));
	spinSpeed.addEventListener('input', () => setState({ spinSpeed: Number(spinSpeed.value) }));
}

function clipName() {
	return state.spin ? `spin_${state.look}` : `${state.camera}_${state.look}`;
}

function setState(changes) {
	const previousClip = clipName();
	Object.assign(state, changes);
	renderPanel();
	if (clipName() !== previousClip) {
		loadClip();
	}
	applyPlaybackRate();
}

function renderPanel() {
	panelButtons.forEach(({ button, isPressed }) => button.setAttribute('aria-pressed', String(isPressed())));
	spinButton.setAttribute('aria-pressed', String(state.spin));
	pipButton.setAttribute('aria-pressed', String(state.pip));
	spinSpeed.disabled = !state.spin;
	spinSpeed.parentElement.classList.toggle('disabled', !state.spin);
	pip.hidden = !state.pip;
	const look = LOOKS.find((item) => item.key === state.look);
	const camera = CAMERAS.find((item) => item.key === state.camera);
	stageLabel.textContent = `${state.spin ? 'Spin' : camera.label} · ${look.label}`;
	lookNote.textContent = look.note;
}

function loadClip() {
	// Keep the time position so switching views feels continuous
	const keepTime = mainVideo.currentTime || 0;
	const name = clipName();
	loading.classList.add('on');
	mainVideo.poster = `media/${name}.jpg`;
	mainVideo.src = `media/${name}.mp4`;
	fxVideo.src = `media/${name}_fx.mp4`;
	mainVideo.addEventListener('loadedmetadata', () => {
		mainVideo.currentTime = keepTime % (mainVideo.duration || 1);
		fxVideo.currentTime = mainVideo.currentTime;
		applyPlaybackRate();
		Promise.all([mainVideo.play(), fxVideo.play()]).catch(() => {});
	}, { once: true });
	mainVideo.addEventListener('playing', () => loading.classList.remove('on'), { once: true });
}

function applyPlaybackRate() {
	const rate = state.spin ? state.spinSpeed : 1;
	mainVideo.playbackRate = rate;
	fxVideo.playbackRate = rate;
}

function keepEffectInSync() {
	// The effect clip was recorded alongside the view, so both share one timeline
	if (state.pip && !mainVideo.paused && Math.abs(fxVideo.currentTime - mainVideo.currentTime) > SYNC_TOLERANCE) {
		fxVideo.currentTime = mainVideo.currentTime;
	}
	if (fxVideo.paused && !mainVideo.paused) {
		fxVideo.play().catch(() => {});
	}
	requestAnimationFrame(keepEffectInSync);
}

// Drawings

function svgElement(tag, attributes) {
	const element = document.createElementNS(SVG_NS, tag);
	Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
	return element;
}

function metres(value) {
	return `${value.toLocaleString('nl-NL', { maximumFractionDigits: 1 })} m`;
}

function size(width, depth) {
	const format = (value) => value.toLocaleString('nl-NL', { maximumFractionDigits: 1 });
	return `${format(width)} × ${format(depth)} m`;
}

/**
 * Places numbered markers on a drawing and writes the matching legend below it.
 * Drawing object: { svg, legendId, markers: [{ x, y, text }] }
 */
function addMarkers(drawing) {
	const legend = document.getElementById(drawing.legendId);
	drawing.markers.forEach((marker, index) => {
		drawing.svg.append(svgElement('circle', { cx: marker.x, cy: marker.y, r: MARKER_RADIUS, class: 'd-marker' }));
		const number = svgElement('text', { x: marker.x, y: marker.y + 0.12, 'text-anchor': 'middle', class: 'd-marker-text' });
		number.textContent = String(index + 1);
		drawing.svg.append(number);
		const item = document.createElement('li');
		item.textContent = marker.text;
		legend.append(item);
	});
}

function seededRandom(seed) {
	let value = seed;
	return () => {
		value = (value * 16807) % 2147483647;
		return (value - 1) / 2147483646;
	};
}

function crowdPositions() {
	const random = seededRandom(7);
	const [areaX, areaZ] = SPEC.crowd_area;
	return Array.from({ length: SPEC.crowd_count }, () => [(random() - 0.5) * areaX, (random() - 0.5) * areaZ]);
}

function drawTopView() {
	const svg = document.getElementById('topView');
	const [floorX, floorZ] = SPEC.floor;
	svg.setAttribute('viewBox', `${-floorX / 2 - 0.6} ${-floorZ / 2 - 0.6} ${floorX + 1.2} ${floorZ + 1.9}`);

	svg.append(svgElement('rect', { x: -floorX / 2, y: -floorZ / 2, width: floorX, height: floorZ, class: 'd-floor' }));
	const [areaX, areaZ] = SPEC.crowd_area;
	svg.append(svgElement('rect', { x: -areaX / 2, y: -areaZ / 2, width: areaX, height: areaZ, class: 'd-crowd' }));
	crowdPositions().forEach(([x, z]) => svg.append(svgElement('circle', { cx: x, cy: z, r: 0.15, class: 'd-person' })));

	// Mirror footprint seen from above, with its panel grid
	const xs = SPEC.mirror_corners.map((corner) => corner[0]);
	const zs = SPEC.mirror_corners.map((corner) => corner[2]);
	const mirror = { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
	svg.append(svgElement('rect', { x: mirror.x0, y: mirror.z0, width: mirror.x1 - mirror.x0, height: mirror.z1 - mirror.z0, class: 'd-mirror' }));
	const columns = Math.max(1, Math.round(SPEC.mirror_size[0] / SPEC.mirror_panel));
	const rows = Math.max(1, Math.round(SPEC.mirror_size[1] / SPEC.mirror_panel));
	for (let i = 1; i < columns; i += 1) {
		const x = mirror.x0 + (mirror.x1 - mirror.x0) * i / columns;
		svg.append(svgElement('line', { x1: x, y1: mirror.z0, x2: x, y2: mirror.z1, class: 'd-seam' }));
	}
	for (let i = 1; i < rows; i += 1) {
		const z = mirror.z0 + (mirror.z1 - mirror.z0) * i / rows;
		svg.append(svgElement('line', { x1: mirror.x0, y1: z, x2: mirror.x1, y2: z, class: 'd-seam' }));
	}

	// Truss frame with its four towers
	const { hx, hz } = SPEC.truss;
	const trussSize = SPEC.truss.size;
	svg.append(svgElement('rect', { x: -hx, y: -hz, width: hx * 2, height: hz * 2, class: 'd-truss' }));
	[[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].forEach(([x, z]) => {
		svg.append(svgElement('rect', { x: x - trussSize / 2, y: z - trussSize / 2, width: trussSize, height: trussSize, class: 'd-tower' }));
	});

	// DJ booth at the front
	const boothZ = SPEC.booth.z;
	svg.append(svgElement('rect', { x: -1.6, y: boothZ - 1, width: 3.2, height: 2, class: 'd-booth' }));
	svg.append(svgElement('circle', { cx: SPEC.booth.dj[0], cy: SPEC.booth.dj[2], r: 0.2, class: 'd-projector' }));

	// Projector and its throw towards the mirror
	const [projX, projY, projZ] = SPEC.projector_pos;
	const [aimX, aimY, aimZ] = SPEC.projector_aim;
	const throwDistance = Math.hypot(aimX - projX, aimY - projY, aimZ - projZ);
	const halfWidth = Math.tan((SPEC.projector_fov / 2) * Math.PI / 180) * throwDistance;
	svg.append(svgElement('polygon', { points: `${projX},${projZ} ${aimX - halfWidth},${aimZ} ${aimX + halfWidth},${aimZ}`, class: 'd-beam' }));
	svg.append(svgElement('rect', { x: projX - 0.3, y: projZ - 0.22, width: 0.6, height: 0.44, class: 'd-projector' }));

	addMarkers({
		svg,
		legendId: 'topLegend',
		markers: [
			{ x: mirror.x0 + 0.55, y: mirror.z0 + 0.55, text: `Spiegel ${size(SPEC.mirror_size[0], SPEC.mirror_size[1])}, panelen van ca. ${metres(SPEC.mirror_panel)}` },
			{ x: hx, y: 0, text: `Truss ${size(hx * 2, hz * 2)}, op vier torens` },
			{ x: 2.3, y: boothZ, text: 'DJ-booth op een riser' },
			{ x: projX + 0.85, y: projZ, text: `Projector en camera, ${metres(projZ)} achter het midden, ${metres(projY)} hoog` },
			{ x: areaX / 2, y: areaZ / 2, text: `Publiek op ${size(areaX, areaZ)}, ${SPEC.crowd_count} dansers` },
			{ x: -floorX / 2, y: floorZ / 2, text: `Dansvloer ${size(floorX, floorZ)}` },
		],
	});
}

function reflect(vector, normal) {
	const dot = vector[0] * normal[0] + vector[1] * normal[1];
	return [vector[0] - 2 * dot * normal[0], vector[1] - 2 * dot * normal[1]];
}

function rotate(vector, angle) {
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	return [vector[0] * cos - vector[1] * sin, vector[0] * sin + vector[1] * cos];
}

/**
 * Follows one projector ray in the side plane (z, y): to the mirror, then reflected down to the floor.
 * Ray object: { origin, direction, mirrorPoint, normal }
 */
function traceRay(ray) {
	const toPlane = [ray.mirrorPoint[0] - ray.origin[0], ray.mirrorPoint[1] - ray.origin[1]];
	const along = (toPlane[0] * ray.normal[0] + toPlane[1] * ray.normal[1]) / (ray.direction[0] * ray.normal[0] + ray.direction[1] * ray.normal[1]);
	const hit = [ray.origin[0] + ray.direction[0] * along, ray.origin[1] + ray.direction[1] * along];
	const bounce = reflect(ray.direction, ray.normal);
	const toFloor = -hit[1] / bounce[1];
	return { hit, floor: [hit[0] + bounce[0] * toFloor, 0] };
}

function drawSideView() {
	const svg = document.getElementById('sideView');
	const [, floorZ] = SPEC.floor;
	const wall = SPEC.wallheight;
	// Side view: z runs left (DJ) to right (projector), y runs up; SVG y is flipped by drawing at -y
	svg.setAttribute('viewBox', `${-floorZ / 2 - 0.6} ${-wall - 1.25} ${floorZ + 2.4} ${wall + 1.85}`);

	svg.append(svgElement('line', { x1: -floorZ / 2, y1: 0, x2: floorZ / 2 + 1.4, y2: 0, class: 'd-floorline' }));

	// Light path: projector up into the mirror, reflected down onto the crowd
	const [, projY, projZ] = SPEC.projector_pos;
	const [, aimY, aimZ] = SPEC.projector_aim;
	const tilt = SPEC.mirror_tilt * Math.PI / 180;
	const normal = [Math.sin(tilt), -Math.cos(tilt)];
	const [, mirrorY, mirrorZ] = SPEC.mirror_center;
	const centre = [aimZ - projZ, aimY - projY];
	const length = Math.hypot(centre[0], centre[1]);
	const direction = [centre[0] / length, centre[1] / length];
	const halfAngle = Math.atan(Math.tan((SPEC.projector_fov / 2) * Math.PI / 180) * 9 / 16);
	const edges = [-halfAngle, halfAngle].map((angle) => traceRay({ origin: [projZ, projY], direction: rotate(direction, angle), mirrorPoint: [mirrorZ, mirrorY], normal }));
	const middle = traceRay({ origin: [projZ, projY], direction, mirrorPoint: [mirrorZ, mirrorY], normal });
	svg.append(svgElement('polygon', { points: `${projZ},${-projY} ${edges[0].hit[0]},${-edges[0].hit[1]} ${edges[1].hit[0]},${-edges[1].hit[1]}`, class: 'd-beam' }));
	svg.append(svgElement('polygon', { points: [edges[0].hit, edges[1].hit, edges[1].floor, edges[0].floor].map((point) => `${point[0]},${-point[1]}`).join(' '), class: 'd-beam' }));
	svg.append(svgElement('polyline', { points: `${projZ},${-projY} ${middle.hit[0]},${-middle.hit[1]} ${middle.floor[0]},${-middle.floor[1]}`, class: 'd-ray' }));

	// Crowd and DJ
	const random = seededRandom(3);
	const [, areaZ] = SPEC.crowd_area;
	for (let i = 0; i < 12; i += 1) {
		const z = -areaZ / 2 + areaZ * (i + 0.5) / 12 + (random() - 0.5) * 0.3;
		const height = 1.6 + random() * 0.2;
		svg.append(svgElement('rect', { x: z - 0.16, y: -height + 0.25, width: 0.32, height: height - 0.25, class: 'd-person' }));
		svg.append(svgElement('circle', { cx: z, cy: -height + 0.1, r: 0.12, class: 'd-person' }));
	}
	const boothZ = SPEC.booth.z;
	const riser = SPEC.booth.riser;
	const djZ = SPEC.booth.dj[2];
	svg.append(svgElement('rect', { x: boothZ - 1, y: -riser, width: 2, height: riser, class: 'd-booth' }));
	svg.append(svgElement('rect', { x: boothZ + 0.15, y: -riser - 0.95, width: 0.7, height: 0.95, class: 'd-booth' }));
	svg.append(svgElement('rect', { x: djZ - 0.16, y: -riser - 1.55, width: 0.32, height: 1.45, class: 'd-person' }));
	svg.append(svgElement('circle', { cx: djZ, cy: -riser - 1.65, r: 0.12, class: 'd-person' }));

	// Truss towers and frame
	const { frameY, hz } = SPEC.truss;
	const trussSize = SPEC.truss.size;
	[-hz, hz].forEach((z) => svg.append(svgElement('rect', { x: z - trussSize / 2, y: -frameY - trussSize / 2, width: trussSize, height: frameY + trussSize / 2, class: 'd-truss' })));
	svg.append(svgElement('rect', { x: -hz, y: -frameY - trussSize / 2, width: hz * 2, height: trussSize, class: 'd-truss' }));

	// Mirror as seen from the side
	const ends = SPEC.mirror_corners.slice(1, 3);
	svg.append(svgElement('line', { x1: ends[0][2], y1: -ends[0][1], x2: ends[1][2], y2: -ends[1][1], class: 'd-mirror' }));

	// Projector on its stand
	svg.append(svgElement('line', { x1: projZ, y1: 0, x2: projZ, y2: -projY, class: 'd-dim' }));
	svg.append(svgElement('rect', { x: projZ - 0.25, y: -projY - 0.15, width: 0.5, height: 0.3, class: 'd-projector' }));

	// Markers sit just beside what they point at
	const lowEnd = ends[1];
	const mirrorMarkerZ = lowEnd[2] + 0.5;
	const mirrorHeightThere = lowEnd[1] + Math.tan(tilt) * 0.5;
	const incoming = [(projZ + middle.hit[0]) / 2, -(projY + middle.hit[1]) / 2];
	addMarkers({
		svg,
		legendId: 'sideLegend',
		markers: [
			{ x: mirrorMarkerZ, y: -mirrorHeightThere - 0.55, text: `Spiegel, ${SPEC.mirror_tilt}° gekanteld, midden op ${metres(mirrorY)}` },
			{ x: -hz + 1.2, y: -frameY - 0.55, text: `Truss op ${metres(frameY)}` },
			{ x: projZ, y: -projY - 0.6, text: `Projector en camera op een standaard van ${metres(projY)}` },
			{ x: incoming[0] + 0.45, y: incoming[1] + 0.3, text: 'Lichtweg omhoog, de spiegel in' },
			{ x: middle.floor[0] + 0.55, y: -2.4, text: 'Van bovenaf op het publiek' },
			{ x: djZ, y: -riser - 2.2, text: `DJ op een riser van ${Math.round(riser * 100)} cm` },
		],
	});
}

function buildSpecs() {
	const list = document.getElementById('specList');
	const { frameY, hx, hz } = SPEC.truss;
	const [, projY, projZ] = SPEC.projector_pos;
	const specs = [
		['Spiegel', `${size(SPEC.mirror_size[0], SPEC.mirror_size[1])} over de hele dansvloer, panelen van ca. ${metres(SPEC.mirror_panel)}. Midden op ${metres(SPEC.mirror_center[1])}, ${SPEC.mirror_tilt}° gekanteld naar de projector.`],
		['Truss', `Vierkant frame van ${size(hx * 2, hz * 2)} op ${metres(frameY)} hoogte. Box truss van ${Math.round(SPEC.truss.size * 100)} cm (F34) op vier torens.`],
		['Projector', `Op een standaard van ${metres(projY)}, ${metres(projZ)} achter het midden van de zaal. ${SPEC.projector_fov}° horizontale worp, gericht op de spiegel.`],
		['Camera', 'Naast de projector, filmt via de spiegel. Liefst infrarood met IR-licht, dan stoort de projectie het beeld niet.'],
		['Dansvloer', `${size(SPEC.floor[0], SPEC.floor[1])} in de previz. Publiek op ${size(SPEC.crowd_area[0], SPEC.crowd_area[1])}: ${SPEC.crowd_count} dansers op ${SPEC.bpm} BPM.`],
		['Show-licht', `${SPEC.pars} pars aan de truss, 2 washes en een strobe, allemaal op dezelfde beat.`],
		['DJ', `Booth op een riser van ${Math.round(SPEC.booth.riser * 100)} cm aan de voorkant. Het publiek kijkt naar de DJ.`],
	];
	specs.forEach(([term, description]) => {
		const card = document.createElement('div');
		card.className = 'reveal';
		const core = document.createElement('div');
		core.className = 'spec-core';
		const title = document.createElement('span');
		title.className = 'spec-term';
		title.textContent = term;
		const text = document.createElement('p');
		text.textContent = description;
		core.append(title, text);
		card.append(core);
		list.append(card);
	});
}

function revealOnScroll() {
	// Fade sections in as they enter the viewport
	const items = document.querySelectorAll('.reveal');
	if (!('IntersectionObserver' in window)) {
		items.forEach((item) => item.classList.add('in'));
		return;
	}
	const observer = new IntersectionObserver((entries) => {
		entries.forEach((entry) => {
			if (entry.isIntersecting) {
				entry.target.classList.add('in');
				observer.unobserve(entry.target);
			}
		});
	}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
	items.forEach((item) => observer.observe(item));
}

buildPanel();
renderPanel();
loadClip();
requestAnimationFrame(keepEffectInSync);
drawTopView();
drawSideView();
buildSpecs();
revealOnScroll();
