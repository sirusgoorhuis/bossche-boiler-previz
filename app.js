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
	{ key: 'show', label: 'Show', note: 'Projector en strobe, zoals op de avond zelf.' },
	{ key: 'projection', label: 'Projection Only', note: 'Alleen de projector. Zo zie je wat het effect met het publiek doet.' },
	{ key: 'worklight', label: 'Work Light', note: 'Zaallicht aan, om de opstelling zelf te zien.' },
];

// The previz clips were recorded with Lava Blobs; the other effects open in the effects section below
const EFFECTS = [
	{ key: 'lavablobs', label: 'Lava Blobs', inViewer: true },
	{ key: 'slimetext', label: 'Slime Text', inShowcase: true },
	{ key: 'pointcloud', label: 'Point Cloud', inShowcase: true },
	{ key: 'relocator', label: 'Pixel Relocator', inShowcase: true },
];

const SHOWCASE = [
	{
		key: 'lavablobs',
		label: 'Lava Blobs',
		text: 'Beweging in het camerabeeld maakt een soort was die opstijgt, samensmelt en weer oplost. Wie stilstaat, zakt langzaam weg uit het beeld. Wie beweegt, snijdt er gaten in.',
		audio: [['Kick', 'de blobs zwellen op en glanzen'], ['Bas', 'de stroming wordt onrustiger'], ['BPM', 'hoe sneller de plaat, hoe sneller de was stijgt']],
	},
	{
		key: 'slimetext',
		label: 'Slime Text',
		text: 'BOSSCHE BOILER in Rubik Mono One, een lettertype waarin elke letter even breed is. Meestal valt het woord uit elkaar: eerst één grote letter per tel, dan een paar losse letters verspreid over het beeld. Om de acht maten staat het hele woord er weer. De letters zijn om de beurt gevuld met groen slijm en een tunnel van cellen, of opgebouwd uit tekens. Hier is geen camera voor nodig.',
		audio: [['Beat', 'elke tel een nieuwe letter of een nieuwe plek'], ['Kick', 'de letters springen op en de randen lichten op'], ['Bas', 'het slijm glanst feller en de donkere gaten tussen de tekens groeien'], ['Drop', 'meer slijm in de letters']],
	},
	{
		key: 'pointcloud',
		label: 'Point Cloud',
		text: 'De randen van alles wat de camera ziet worden een wolk van 65.000 punten. De punten ontstaan op de contouren van de dansers en waaien daarna weg als stof. Beweegt de hele zaal, dan kiest het effect alleen de sterkste randen, zodat het beeld niet dichtslibt.',
		audio: [['Kick', 'een stoot nieuwe punten, en de punten worden even groter'], ['BPM', 'bij een hogere BPM waaien de punten sneller weg']],
	},
	{
		key: 'relocator',
		label: 'Pixel Relocator',
		text: 'Negen videoloops veranderen in een glanzende, gevouwen vloeistof. Elke pixel staat rechtop als een zuiltje. Hoe lichter de pixel, hoe hoger het zuiltje. Zo rekken heldere vormen uit tot strepen met zaagtanden. Waar de dansers bewegen, komt het oppervlak omhoog.',
		audio: [['Beat', 'om de 16 tellen wisselt de videoloop'], ['Kick', 'de zuiltjes schieten verder uit en de punten lichten op'], ['Bas', 'de vloeistof golft dieper'], ['Drop', 'de kleuren schuiven verder uit elkaar']],
	},
];

const SHOWCASE_VIEWS = [
	{ key: 'effect', label: 'Effect', caption: 'Wat de projector toont' },
	{ key: 'room', label: 'In de zaal', caption: 'Van bovenaf in de previz' },
];

const SYNC_TOLERANCE = 0.08;
const SVG_NS = 'http://www.w3.org/2000/svg';
const MARKER_RADIUS = 0.3;
const DEG = Math.PI / 180;
// Room the dancers leave around the DJ booth (x, z), as in the Previz
const BOOTH_CLEARANCE = [3.0, 1.4];

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
const showcase = { effect: 'slimetext', view: 'effect', visible: false };
const showcaseVideo = document.getElementById('showcaseVideo');
const showcaseButtons = [];

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
			title: effect.inViewer ? effect.label : (effect.inShowcase ? 'Bekijk dit effect hieronder bij Effecten' : 'Nog te bouwen'),
			isDisabled: !effect.inViewer && !effect.inShowcase,
			isPressed: () => state.effect === effect.key,
			onClick: () => (effect.inViewer ? setState({ effect: effect.key }) : openInShowcase(effect.key)),
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

// Effects showcase: one large player, the effect itself or the same moment seen from above in the previz

function showcaseClip() {
	return showcase.view === 'room' ? `effect_${showcase.effect}_room` : `effect_${showcase.effect}`;
}

/**
 * Builds a showcase button.
 * Settings object: { label, isPressed, onClick }
 */
function showcaseButton(settings) {
	const button = document.createElement('button');
	button.className = 'btn';
	button.textContent = settings.label;
	button.addEventListener('click', settings.onClick);
	showcaseButtons.push({ button, isPressed: settings.isPressed });
	return button;
}

function buildShowcase() {
	const effects = document.getElementById('showcaseEffects');
	SHOWCASE.forEach((effect) => effects.append(showcaseButton({
		label: effect.label,
		isPressed: () => showcase.effect === effect.key,
		onClick: () => setShowcase({ effect: effect.key }),
	})));
	const views = document.getElementById('showcaseViews');
	SHOWCASE_VIEWS.forEach((view) => views.append(showcaseButton({
		label: view.label,
		isPressed: () => showcase.view === view.key,
		onClick: () => setShowcase({ view: view.key }),
	})));
}

function renderShowcase() {
	const effect = SHOWCASE.find((item) => item.key === showcase.effect);
	const view = SHOWCASE_VIEWS.find((item) => item.key === showcase.view);
	showcaseButtons.forEach(({ button, isPressed }) => button.setAttribute('aria-pressed', String(isPressed())));
	document.getElementById('showcaseLabel').textContent = `${effect.label} · ${view.caption}`;
	document.getElementById('showcaseTitle').textContent = effect.label;
	document.getElementById('showcaseText').textContent = effect.text;
	const list = document.getElementById('showcaseAudio');
	list.innerHTML = '';
	effect.audio.forEach(([cue, response]) => {
		const item = document.createElement('li');
		const term = document.createElement('span');
		term.textContent = cue;
		item.append(term, document.createTextNode(response));
		list.append(item);
	});
}

function loadShowcaseClip(keepTime) {
	// Effect and room were recorded at the same time, so switching the view keeps the moment
	const time = keepTime ? showcaseVideo.currentTime || 0 : 0;
	showcaseVideo.poster = `media/effect_${showcase.effect}.jpg`;
	showcaseVideo.src = `media/${showcaseClip()}.mp4`;
	showcaseVideo.addEventListener('loadedmetadata', () => {
		showcaseVideo.currentTime = time % (showcaseVideo.duration || 1);
		if (showcase.visible) showcaseVideo.play().catch(() => {});
	}, { once: true });
	if (showcase.visible) showcaseVideo.load();
}

function setShowcase(changes) {
	const sameEffect = !changes.effect || changes.effect === showcase.effect;
	Object.assign(showcase, changes);
	renderShowcase();
	loadShowcaseClip(sameEffect);
}

function openInShowcase(key) {
	setShowcase({ effect: key });
	document.getElementById('effecten').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function playShowcaseWhenVisible() {
	// The clips are heavy: only load and play while the player is on screen
	if (!('IntersectionObserver' in window)) {
		showcase.visible = true;
		showcaseVideo.preload = 'auto';
		showcaseVideo.play().catch(() => {});
		return;
	}
	new IntersectionObserver((entries) => {
		showcase.visible = entries[0].isIntersecting;
		if (showcase.visible) {
			showcaseVideo.preload = 'auto';
			showcaseVideo.play().catch(() => {});
		} else {
			showcaseVideo.pause();
		}
	}, { threshold: 0.25 }).observe(document.getElementById('showcaseStage'));
}

// Drawings

function svgElement(tag, attributes) {
	const element = document.createElementNS(SVG_NS, tag);
	Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
	return element;
}

function metres(value) {
	return `${value.toLocaleString('nl-NL', { maximumFractionDigits: 2 })} m`;
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
	// Dancers spread over the crowd area, keeping clear of the DJ booth in the middle
	const random = seededRandom(7);
	const [areaX, areaZ] = SPEC.crowd_area;
	const positions = [];
	while (positions.length < SPEC.crowd_count) {
		const x = (random() - 0.5) * areaX;
		const z = (random() - 0.5) * areaZ;
		if (Math.abs(x - SPEC.booth.x) > BOOTH_CLEARANCE[0] || Math.abs(z - SPEC.booth.z) > BOOTH_CLEARANCE[1]) positions.push([x, z]);
	}
	return positions;
}

function projectorFootprint(height) {
	// Half width (x) and half depth (z) of the projected image at a height, for a projector pointing straight down
	const [, projY] = SPEC.projector.pos;
	const halfWidth = Math.tan((SPEC.projector.fov / 2) * DEG) * (projY - height);
	return { halfWidth, halfDepth: halfWidth * 9 / 16 };
}

function cameraView() {
	// The camera's centre line and the rays along the top and bottom of its picture, in the side plane (z, y)
	const { pos, aim, fov } = SPEC.camera;
	const pitch = Math.atan2(aim[1] - pos[1], Math.hypot(aim[0] - pos[0], aim[2] - pos[2]));
	const halfHeight = Math.atan(Math.tan((fov / 2) * DEG) * 9 / 16);
	return { pitch, low: pitch - halfHeight, high: pitch + halfHeight };
}

function drawTopView() {
	const svg = document.getElementById('topView');
	const [floorX, floorZ] = SPEC.floor;
	svg.setAttribute('viewBox', `${-floorX / 2 - 0.6} ${-floorZ / 2 - 0.6} ${floorX + 1.2} ${floorZ + 1.2}`);

	svg.append(svgElement('rect', { x: -floorX / 2, y: -floorZ / 2, width: floorX, height: floorZ, class: 'd-floor' }));
	const [areaX, areaZ] = SPEC.crowd_area;
	svg.append(svgElement('rect', { x: -areaX / 2, y: -areaZ / 2, width: areaX, height: areaZ, class: 'd-crowd' }));

	// The projected image on the floor, cut off by the walls
	const [projX, , projZ] = SPEC.projector.pos;
	const image = projectorFootprint(0);
	const imageX0 = Math.max(-floorX / 2, projX - image.halfWidth);
	const imageX1 = Math.min(floorX / 2, projX + image.halfWidth);
	const imageZ0 = Math.max(-floorZ / 2, projZ - image.halfDepth);
	const imageZ1 = Math.min(floorZ / 2, projZ + image.halfDepth);
	svg.append(svgElement('rect', { x: imageX0, y: imageZ0, width: imageX1 - imageX0, height: imageZ1 - imageZ0, class: 'd-beam' }));
	crowdPositions().forEach(([x, z]) => svg.append(svgElement('circle', { cx: x, cy: z, r: 0.15, class: 'd-person' })));

	// DJ booth: riser with a speaker either side
	const { x: boothX, z: boothZ } = SPEC.booth;
	svg.append(svgElement('rect', { x: boothX - 1.6, y: boothZ - 1, width: 3.2, height: 2, class: 'd-booth' }));
	[-2.3, 2.3].forEach((dx) => svg.append(svgElement('rect', { x: boothX + dx - 0.35, y: boothZ - 0.05, width: 0.7, height: 0.7, class: 'd-booth' })));
	svg.append(svgElement('circle', { cx: SPEC.booth.dj[0], cy: SPEC.booth.dj[2], r: 0.2, class: 'd-person' }));

	// Truss frame, crossbeams and the four towers
	const { hx, hz, size: trussSize, crossbeams } = SPEC.truss;
	const [trussX, trussZ] = SPEC.truss.center;
	svg.append(svgElement('rect', { x: trussX - hx, y: trussZ - hz, width: hx * 2, height: hz * 2, class: 'd-truss' }));
	crossbeams.forEach((x) => svg.append(svgElement('line', { x1: x, y1: trussZ - hz, x2: x, y2: trussZ + hz, class: 'd-truss' })));
	[[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].forEach(([x, z]) => {
		svg.append(svgElement('rect', { x: trussX + x - trussSize / 2, y: trussZ + z - trussSize / 2, width: trussSize, height: trussSize, class: 'd-tower' }));
	});

	// Mirrors with their panels, hoists and bridles
	SPEC.mirrors.forEach((mirror) => {
		const xs = mirror.corners.map((corner) => corner[0]);
		const zs = mirror.corners.map((corner) => corner[2]);
		const box = { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
		svg.append(svgElement('rect', { x: box.x0, y: box.z0, width: box.x1 - box.x0, height: box.z1 - box.z0, class: 'd-mirror' }));
		const panels = Math.max(1, Math.round((box.z1 - box.z0) / mirror.panel));
		for (let i = 1; i < panels; i += 1) {
			const z = box.z0 + (box.z1 - box.z0) * i / panels;
			svg.append(svgElement('line', { x1: box.x0, y1: z, x2: box.x1, y2: z, class: 'd-seam' }));
		}
		mirror.hoists.forEach((hoist) => {
			mirror.corners.filter((corner) => (corner[2] - mirror.center[2]) * (hoist[2] - mirror.center[2]) > 0).forEach((corner) => {
				svg.append(svgElement('line', { x1: hoist[0], y1: hoist[2], x2: corner[0], y2: corner[2], class: 'd-cable' }));
			});
			svg.append(svgElement('rect', { x: hoist[0] - 0.12, y: hoist[2] - 0.12, width: 0.24, height: 0.24, class: 'd-hoist' }));
		});
	});

	// Projector in the middle, camera and strobe on the front truss
	svg.append(svgElement('rect', { x: projX - 0.3, y: projZ - 0.22, width: 0.6, height: 0.44, class: 'd-projector' }));
	const [camX, , camZ] = SPEC.camera.pos;
	const [aimX, , aimZ] = SPEC.camera.aim;
	const heading = Math.atan2(aimX - camX, aimZ - camZ);
	const reach = 3.2;
	const spread = (SPEC.camera.fov / 2) * DEG;
	const edge = (angle) => `${camX + Math.sin(heading + angle) * reach},${camZ + Math.cos(heading + angle) * reach}`;
	svg.append(svgElement('polygon', { points: `${camX},${camZ} ${edge(-spread)} ${edge(spread)}`, class: 'd-camview' }));
	svg.append(svgElement('rect', { x: camX - 0.22, y: camZ - 0.15, width: 0.44, height: 0.3, class: 'd-camera' }));
	svg.append(svgElement('circle', { cx: SPEC.strobe[0] + 0.6, cy: SPEC.strobe[2], r: 0.16, class: 'd-strobe' }));

	const left = SPEC.mirrors[0];
	const mirrorGap = SPEC.mirrors.length > 1 ? Math.abs(SPEC.mirrors[1].center[0] - left.center[0]) : 0;
	addMarkers({
		svg,
		legendId: 'topLegend',
		markers: [
			{ x: left.center[0] - left.size[0] / 2 - 0.5, y: left.center[2] + left.size[1] / 2 - 0.3, text: `${SPEC.mirrors.length === 2 ? 'Twee spiegels' : 'Spiegel'} van ${size(left.size[0], left.size[1])}${mirrorGap ? `, ${metres(mirrorGap)} uit elkaar` : ''}, elk aan twee kettingtakels` },
			{ x: trussX + hx, y: trussZ - hz + 1.1, text: `Truss ${size(hx * 2, hz * 2)} met ${crossbeams.length} dwarsbalken, op vier torens` },
			{ x: projX + 0.75, y: projZ - 0.75, text: `Projector in het midden; het beeld valt op ${size(imageX1 - imageX0, imageZ1 - imageZ0)} van de vloer` },
			{ x: camX - 0.75, y: camZ + 0.55, text: 'Camera en strobe aan de voorkant van de truss' },
			{ x: boothX - 0.6, y: boothZ - 1.45, text: 'DJ-booth midden op de vloer' },
			{ x: areaX / 2, y: areaZ / 2, text: `Publiek op ${size(areaX, areaZ)}, ${SPEC.crowd_count} dansers` },
			{ x: -floorX / 2, y: floorZ / 2, text: `Dansvloer ${size(floorX, floorZ)}` },
		],
	});
}

function drawSideView() {
	const svg = document.getElementById('sideView');
	const [, floorZ] = SPEC.floor;
	const wall = SPEC.wallheight;
	// Side view from the right: z runs from the back wall (left) to the front (right), y runs up; SVG y is flipped by drawing at -y
	svg.setAttribute('viewBox', `${-floorZ / 2 - 0.6} ${-wall - 1.3} ${floorZ + 1.2} ${wall + 1.9}`);
	svg.append(svgElement('line', { x1: -floorZ / 2, y1: 0, x2: floorZ / 2, y2: 0, class: 'd-floorline' }));
	[-floorZ / 2, floorZ / 2].forEach((z) => svg.append(svgElement('line', { x1: z, y1: 0, x2: z, y2: -wall, class: 'd-dim' })));

	// Projector beam straight down; the narrow side of the picture runs along z
	const [, projY, projZ] = SPEC.projector.pos;
	const image = projectorFootprint(0);
	svg.append(svgElement('polygon', { points: `${projZ},${-projY} ${projZ - image.halfDepth},0 ${projZ + image.halfDepth},0`, class: 'd-beam' }));

	// What the camera sees: from the bottom of its picture on the floor up to the back wall
	const [, camY, camZ] = SPEC.camera.pos;
	const view = cameraView();
	const backZ = -floorZ / 2;
	const floorHit = Math.max(backZ, camZ - camY / Math.tan(-view.low));
	const wallHeight = Math.min(wall, camY + Math.tan(view.high) * (camZ - backZ));
	svg.append(svgElement('polygon', { points: `${camZ},${-camY} ${floorHit},0 ${backZ},0 ${backZ},${-wallHeight}`, class: 'd-camview' }));

	// Crowd, front and back of the booth
	const random = seededRandom(3);
	const [, areaZ] = SPEC.crowd_area;
	for (let i = 0; i < 16; i += 1) {
		const z = -areaZ / 2 + areaZ * (i + 0.5) / 16 + (random() - 0.5) * 0.3;
		if (Math.abs(z - SPEC.booth.z) < BOOTH_CLEARANCE[1]) continue;
		const height = 1.6 + random() * 0.2;
		svg.append(svgElement('rect', { x: z - 0.16, y: -height + 0.25, width: 0.32, height: height - 0.25, class: 'd-person' }));
		svg.append(svgElement('circle', { cx: z, cy: -height + 0.1, r: 0.12, class: 'd-person' }));
	}
	const { z: boothZ, riser } = SPEC.booth;
	const djZ = SPEC.booth.dj[2];
	svg.append(svgElement('rect', { x: boothZ - 1, y: -riser, width: 2, height: riser, class: 'd-booth' }));
	svg.append(svgElement('rect', { x: boothZ + 0.15, y: -riser - 0.95, width: 0.7, height: 0.95, class: 'd-booth' }));
	svg.append(svgElement('rect', { x: djZ - 0.16, y: -riser - 1.55, width: 0.32, height: 1.45, class: 'd-person' }));
	svg.append(svgElement('circle', { cx: djZ, cy: -riser - 1.65, r: 0.12, class: 'd-person' }));

	// Truss towers and frame
	const { frameY, hz, size: trussSize } = SPEC.truss;
	const trussZ = SPEC.truss.center[1];
	[-hz, hz].forEach((z) => svg.append(svgElement('rect', { x: trussZ + z - trussSize / 2, y: -frameY - trussSize / 2, width: trussSize, height: frameY + trussSize / 2, class: 'd-truss' })));
	svg.append(svgElement('rect', { x: trussZ - hz, y: -frameY - trussSize / 2, width: hz * 2, height: trussSize, class: 'd-truss' }));

	// Mirrors (both line up in this view) with how far the motors move them, hoists and bridles
	const mirror = SPEC.mirrors[0];
	const halfLength = mirror.size[1] / 2;
	const [, mirrorY, mirrorZ] = mirror.center;
	const { low, high } = SPEC.motors;
	[low, high].forEach((y) => svg.append(svgElement('line', { x1: mirrorZ - halfLength, y1: -y, x2: mirrorZ + halfLength, y2: -y, class: 'd-travel' })));
	mirror.hoists.forEach((hoist) => {
		const end = mirrorZ + Math.sign(hoist[2] - mirrorZ) * halfLength;
		svg.append(svgElement('line', { x1: hoist[2], y1: -(hoist[1] - 0.34), x2: end, y2: -mirrorY, class: 'd-cable' }));
		svg.append(svgElement('rect', { x: hoist[2] - 0.12, y: -hoist[1], width: 0.24, height: 0.34, class: 'd-hoist' }));
	});
	svg.append(svgElement('line', { x1: mirrorZ - halfLength, y1: -mirrorY, x2: mirrorZ + halfLength, y2: -mirrorY, class: 'd-mirror' }));

	// Projector under the truss, camera and strobe at the front
	svg.append(svgElement('rect', { x: projZ - 0.25, y: -projY - 0.1, width: 0.5, height: 0.3, class: 'd-projector' }));
	svg.append(svgElement('rect', { x: camZ - 0.2, y: -camY - 0.13, width: 0.4, height: 0.26, class: 'd-camera' }));
	svg.append(svgElement('circle', { cx: SPEC.strobe[2], cy: -SPEC.strobe[1] + 0.25, r: 0.14, class: 'd-strobe' }));

	addMarkers({
		svg,
		legendId: 'sideLegend',
		markers: [
			{ x: mirrorZ - halfLength - 0.55, y: -mirrorY, text: `Spiegels hangen plat op ${metres(mirrorY)}, de spiegelkant naar beneden` },
			{ x: mirrorZ + halfLength + 0.55, y: -(low + high) / 2, text: `De motoren bewegen ze tussen ${metres(low)} en ${metres(high)}` },
			{ x: -hz + 1.0, y: -frameY - 0.55, text: `Truss op ${metres(frameY)}, kettingtakels onder de dwarsbalken` },
			{ x: projZ + 0.75, y: -projY + 0.1, text: `Projector op ${metres(projY)}, ${SPEC.projector.fov}° recht naar beneden` },
			{ x: camZ - 0.2, y: -camY - 0.6, text: `Camera op ${metres(camY)}, ${Math.round(-view.pitch / DEG)}° naar beneden` },
			{ x: djZ + 1.3, y: -riser - 1.9, text: `DJ midden op de vloer, op een riser van ${Math.round(riser * 100)} cm` },
		],
	});
}

function buildSpecs() {
	const list = document.getElementById('specList');
	const { frameY, hx, hz, crossbeams } = SPEC.truss;
	const [, projY] = SPEC.projector.pos;
	const image = projectorFootprint(0);
	const heads = projectorFootprint(1.7);
	const mirror = SPEC.mirrors[0];
	const gap = SPEC.mirrors.length > 1 ? Math.abs(SPEC.mirrors[1].center[0] - mirror.center[0]) : 0;
	const { low, high, speed, beats } = SPEC.motors;
	const specs = [
		['Spiegels', `${SPEC.mirrors.length === 2 ? 'Twee spiegels' : 'Eén spiegel'} van ${size(mirror.size[0], mirror.size[1])}, plat met de spiegelkant naar beneden${gap ? `, ${metres(gap)} uit elkaar` : ''}. Elke spiegel hangt onder een dwarsbalk van de truss.`],
		['Spiegelmotoren', `Twee kettingtakels per spiegel, ${metres(SPEC.truss.hoist_spacing)} uit elkaar. In ${beats} tellen gaat elke spiegel één keer op en neer tussen ${metres(low)} en ${metres(high)}, de ene omhoog als de andere zakt. Hoogstens ${speed.toLocaleString('nl-NL')} m/s.`],
		['Truss', `Vierkant frame van ${size(hx * 2, hz * 2)} op ${metres(frameY)}, met ${crossbeams.length} dwarsbalken van voor naar achter. Box truss van ${Math.round(SPEC.truss.size * 100)} cm (F34) op vier torens.`],
		['Projector', `In het midden van de truss op ${metres(projY)}, recht naar beneden met een lens van ${SPEC.projector.fov}°. Het beeld is ${size(heads.halfWidth * 2, heads.halfDepth * 2)} op hoofdhoogte. Op de vloer is het ${size(image.halfWidth * 2, image.halfDepth * 2)}${image.halfWidth * 2 > SPEC.floor[0] ? ', iets breder dan de zaal' : ''}.`],
		['Camera', `Aan de voorkant van de truss op ${metres(SPEC.camera.pos[1])}, ${Math.round(-cameraView().pitch / DEG)}° naar beneden, lens van ${SPEC.camera.fov}°. Liefst infrarood met IR-licht, dan stoort de projectie het beeld niet.`],
		['Muziek', `TouchDesigner luistert naar de muziek, uit een bestand of de lijningang, en haalt er kick, bas, BPM en drops uit. Effecten, strobe en spiegelmotoren lopen op dezelfde beat.`],
		['Licht', 'Alleen een strobe aan de voorkant van de truss, die op de kick flitst. Al het andere licht komt van de projector.'],
		['Dansvloer', `${size(SPEC.floor[0], SPEC.floor[1])} in de previz. Publiek op ${size(SPEC.crowd_area[0], SPEC.crowd_area[1])}: ${SPEC.crowd_count} dansers. Getest op een nummer van ${SPEC.bpm} BPM.`],
		['DJ', `Booth midden op de vloer, op een riser van ${Math.round(SPEC.booth.riser * 100)} cm. Het publiek staat eromheen.`],
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
buildShowcase();
renderShowcase();
loadShowcaseClip(false);
playShowcaseWhenVisible();
requestAnimationFrame(keepEffectInSync);
drawTopView();
drawSideView();
buildSpecs();
revealOnScroll();
