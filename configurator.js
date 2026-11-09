// Setup configurator: build the projector, camera, truss, mirror and DJ setup in 3D with real-world measurements
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const STORAGE_KEY = 'bb-configurator-v1';
const DEG = Math.PI / 180;
const IMAGE_ASPECT = 16 / 9;
const MOUNT_SPACING = 0.5;
const RAY_COLUMNS = 32;
const RAY_ROWS = 18;
const LINE_STEP = 4;
const EDGE_SAMPLES = 16;
const CROWD_SAMPLES = { columns: 36, rows: 28 };
const ARMS_UP = 0.6;
const ACRYLIC_KG_PER_M2 = 3.6;
const GLASS_KG_PER_M2 = 10;
const MIRROR_REFLECTANCE = 0.9;
const MAX_RAY_LENGTH = 60;
const MAX_BOUNCES = 3;
const CHORD = 0.035;
const LACING = 0.02;
const SAME_RIG_DISTANCE = 1.0;
const SAME_RIG_ANGLE = 15;
const SHORT_SLING = 0.75;
const WHOLE_NUMBER_KEYS = new Set(['crowdCount', 'crossbeams']);
const EFFECT_CLIP = 'media/undermirror_projection_fx.mp4';

const VIEW_PRESETS = {
	perspective: { position: [12.5, 2.6, 14.5], target: [0, 3.4, -0.5] },
	top: { position: [0, 28, 0.01], target: [0, 0, 0] },
	side: { position: [17, 3.2, 0.5], target: [0, 3, 0.5] },
	front: { position: [0, 3.6, 16.5], target: [0, 3.2, 0] },
};

const COLORS = {
	background: 0x07070a,
	floor: 0x121216,
	grid: 0x23232b,
	walls: 0x34343e,
	beamIn: 0xcdb8ff,
	beamOut: 0x8fe7ff,
	camera: 0xffffff,
	truss: 0x9a9aa6,
	mount: 0x5d5d68,
	mountOn: 0xffd27a,
	cable: 0xffd27a,
	selection: 0xcdb8ff,
	person: 0x5a5a66,
};

// Editable fields per object type; sections group them in the panel
const FIELDS = {
	venue: [
		{ section: 'Room' },
		{ key: 'floorW', label: 'Floor width', unit: 'm', step: 0.5, min: 4 },
		{ key: 'floorD', label: 'Floor depth', unit: 'm', step: 0.5, min: 4 },
		{ key: 'wallH', label: 'Wall height', unit: 'm', step: 0.1, min: 2 },
		{ section: 'Crowd' },
		{ key: 'crowdW', label: 'Crowd area width', unit: 'm', step: 0.5, min: 1 },
		{ key: 'crowdD', label: 'Crowd area depth', unit: 'm', step: 0.5, min: 1 },
		{ key: 'crowdCount', label: 'Dancers', unit: '', step: 1, min: 0 },
		{ key: 'headHeight', label: 'Head height', unit: 'm', step: 0.05, min: 1 },
	],
	truss: [
		{ section: 'Position' },
		{ key: 'x', label: 'Left / right', unit: 'm', step: 0.05 },
		{ key: 'z', label: 'Front / back', unit: 'm', step: 0.05 },
		{ section: 'Size' },
		{ key: 'w', label: 'Width', unit: 'm', step: 0.5, min: 1 },
		{ key: 'd', label: 'Depth', unit: 'm', step: 0.5, min: 1 },
		{ key: 'height', label: 'Height (frame centre)', unit: 'm', step: 0.05, min: 1 },
		{ key: 'size', label: 'Truss profile', unit: 'm', step: 0.01, min: 0.1 },
		{ key: 'crossbeams', label: 'Crossbeams', unit: '', step: 1, min: 0, max: 6 },
		{ key: 'towers', label: 'Ground towers on the corners', type: 'check' },
	],
	projector: [
		{ section: 'Position' },
		{ key: 'x', label: 'Left / right', unit: 'm', step: 0.05 },
		{ key: 'y', label: 'Height', unit: 'm', step: 0.05, min: 0 },
		{ key: 'z', label: 'Front / back', unit: 'm', step: 0.05 },
		{ section: 'Aim' },
		{ key: 'yaw', label: 'Pan', unit: '°', step: 1 },
		{ key: 'pitch', label: 'Tilt', unit: '°', step: 1 },
		{ key: 'roll', label: 'Roll', unit: '°', step: 1 },
		{ section: 'Lens' },
		{ key: 'hFov', label: 'Horizontal throw angle', unit: '°', step: 1, min: 5, max: 140 },
		{ key: 'lumens', label: 'Brightness', unit: 'lm', step: 500, min: 0 },
	],
	camera: [
		{ section: 'Position' },
		{ key: 'x', label: 'Left / right', unit: 'm', step: 0.05 },
		{ key: 'y', label: 'Height', unit: 'm', step: 0.05, min: 0 },
		{ key: 'z', label: 'Front / back', unit: 'm', step: 0.05 },
		{ section: 'Aim' },
		{ key: 'yaw', label: 'Pan', unit: '°', step: 1 },
		{ key: 'pitch', label: 'Tilt', unit: '°', step: 1 },
		{ key: 'roll', label: 'Roll', unit: '°', step: 1 },
		{ section: 'Lens' },
		{ key: 'hFov', label: 'Horizontal field of view', unit: '°', step: 1, min: 5, max: 140 },
	],
	mirror: [
		{ section: 'Position' },
		{ key: 'x', label: 'Left / right', unit: 'm', step: 0.05 },
		{ key: 'y', label: 'Centre height', unit: 'm', step: 0.05, min: 0 },
		{ key: 'z', label: 'Front / back', unit: 'm', step: 0.05 },
		{ section: 'Size' },
		{ key: 'w', label: 'Width', unit: 'm', step: 0.1, min: 0.2 },
		{ key: 'd', label: 'Depth', unit: 'm', step: 0.1, min: 0.2 },
		{ key: 'panel', label: 'Panel size', unit: 'm', step: 0.1, min: 0.2 },
		{ section: 'Orientation' },
		{ key: 'tilt', label: 'Tilt towards projector', unit: '°', step: 1 },
		{ key: 'yaw', label: 'Rotation', unit: '°', step: 1 },
		{ key: 'roll', label: 'Roll', unit: '°', step: 1 },
	],
	dj: [
		{ section: 'Position' },
		{ key: 'x', label: 'Left / right', unit: 'm', step: 0.05 },
		{ key: 'z', label: 'Front / back', unit: 'm', step: 0.05 },
		{ key: 'yaw', label: 'Facing', unit: '°', step: 5 },
		{ key: 'riser', label: 'Riser height', unit: 'm', step: 0.05, min: 0 },
	],
};

const HINTS = {
	venue: 'Zaal en publiek. Pas de maten aan in het paneel.',
	truss: 'Sleep om de truss te verplaatsen. Klik de bolletjes op de truss om ophangpunten aan of uit te zetten.',
	projector: 'W verplaatsen, E draaien. De lijnen laten zien waar het beeld via de spiegel landt.',
	camera: 'W verplaatsen, E draaien. De gestippelde lijn is wat de camera via de spiegel ziet.',
	mirror: 'W verplaatsen, E kantelen, R schalen. Delete verwijdert de spiegel.',
	dj: 'Sleep de booth over de vloer, E om te draaien.',
};

const viewportEl = document.getElementById('viewport');
const hintEl = document.getElementById('hint');
const propsEl = document.getElementById('props');
const propsTitleEl = document.getElementById('propsTitle');
const measureEl = document.getElementById('measure');
const warningsEl = document.getElementById('warnings');
const objectListEl = document.getElementById('objectList');
const toastEl = document.getElementById('toast');

const state = {
	setup: loadSetup(),
	selection: 'projector',
	mode: 'translate',
	toggles: { snap: true, beam: true, cameraView: true, crowd: true, labels: true },
	metrics: null,
	cables: [],
	mountPoints: [],
	viewTarget: null,
};

// Setup data

function round(value, digits) {
	const factor = 10 ** digits;
	return Math.round(value * factor) / factor;
}

/**
 * Pan and tilt (degrees) of a device at one point looking at another.
 * Points object: { from: [x, y, z], to: [x, y, z] }
 */
function aimAngles(points) {
	const dx = points.to[0] - points.from[0];
	const dy = points.to[1] - points.from[1];
	const dz = points.to[2] - points.from[2];
	return {
		yaw: round(Math.atan2(-dx, -dz) / DEG, 1),
		pitch: round(Math.atan2(dy, Math.hypot(dx, dz)) / DEG, 1),
	};
}

function defaultSetup() {
	// Starts from the dimensions exported by the TouchDesigner Previz (spec.js)
	// spec.js declares SPEC with const, so it is a global name but not a window property
	const spec = SPEC;
	const projectorPos = spec.projector_pos;
	const aim = aimAngles({ from: projectorPos, to: spec.projector_aim });
	return {
		venue: { floorW: spec.floor[0], floorD: spec.floor[1], wallH: spec.wallheight, crowdW: spec.crowd_area[0], crowdD: spec.crowd_area[1], crowdCount: spec.crowd_count, headHeight: 1.7 },
		truss: { x: 0, z: 0, w: round(spec.truss.hx * 2, 2), d: round(spec.truss.hz * 2, 2), height: spec.truss.frameY, size: spec.truss.size, crossbeams: 0, towers: true },
		projector: { x: projectorPos[0], y: projectorPos[1], z: projectorPos[2], yaw: aim.yaw, pitch: aim.pitch, roll: 0, hFov: spec.projector_fov, lumens: 10000 },
		camera: { x: round(projectorPos[0] + 0.45, 2), y: projectorPos[1], z: projectorPos[2], yaw: aim.yaw, pitch: aim.pitch, roll: 0, hFov: 60 },
		mirrors: [{ id: 'm1', x: spec.mirror_center[0], y: spec.mirror_center[1], z: spec.mirror_center[2], w: spec.mirror_size[0], d: spec.mirror_size[1], tilt: spec.mirror_tilt, yaw: 0, roll: 0, panel: spec.mirror_panel }],
		dj: { x: 0, z: spec.booth.z, yaw: 0, riser: spec.booth.riser },
		mounts: null,
	};
}

function loadSetup() {
	const fallback = defaultSetup();
	try {
		const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
		if (stored && stored.projector && Array.isArray(stored.mirrors)) {
			return mergeSetup({ base: fallback, incoming: stored });
		}
	} catch (error) {
		console.warn('Stored setup ignored', error);
	}
	return fallback;
}

/**
 * Fills gaps in an imported or stored setup with the defaults, so older files keep working.
 * Setups object: { base, incoming }
 */
function mergeSetup(setups) {
	const { base, incoming } = setups;
	const merged = {};
	['venue', 'truss', 'projector', 'camera', 'dj'].forEach((key) => {
		merged[key] = { ...base[key], ...(incoming[key] || {}) };
	});
	merged.mirrors = (incoming.mirrors && incoming.mirrors.length ? incoming.mirrors : base.mirrors).map((mirror, index) => ({ ...base.mirrors[0], ...mirror, id: mirror.id || `m${index + 1}` }));
	merged.mounts = Array.isArray(incoming.mounts) ? incoming.mounts : null;
	return merged;
}

let saveTimer = null;

function saveSoon() {
	clearTimeout(saveTimer);
	saveTimer = setTimeout(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(state.setup)), 400);
}

// Formatting

function fmt(value, digits = 2) {
	if (value === null || value === undefined || Number.isNaN(value)) {
		return '–';
	}
	return value.toLocaleString('nl-NL', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function metres(value) {
	return `${fmt(value)} m`;
}

function percent(value) {
	return `${fmt(value * 100, 0)}%`;
}

function mirrorName(mirror) {
	return `Mirror ${state.setup.mirrors.indexOf(mirror) + 1}`;
}

function selectedMirror() {
	if (!state.selection.startsWith('mirror:')) {
		return null;
	}
	return state.setup.mirrors.find((mirror) => mirror.id === state.selection.slice(7)) || null;
}

function selectionData() {
	const mirror = selectedMirror();
	if (mirror) {
		return { type: 'mirror', data: mirror, name: mirrorName(mirror) };
	}
	const names = { venue: 'Venue', truss: 'Truss', projector: 'Projector', camera: 'Camera', dj: 'DJ booth' };
	return { type: state.selection, data: state.setup[state.selection], name: names[state.selection] };
}

// Geometry helpers shared by the scene and the optics

function mirrorFrame(mirror) {
	// Mirror faces down (-Y) and tilts its +Z edge upwards, like the TouchDesigner Previz
	const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-mirror.tilt * DEG, mirror.yaw * DEG, mirror.roll * DEG, 'YXZ'));
	return {
		id: mirror.id,
		center: new THREE.Vector3(mirror.x, mirror.y, mirror.z),
		normal: new THREE.Vector3(0, -1, 0).applyQuaternion(quaternion),
		axisU: new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion),
		axisV: new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion),
		halfU: mirror.w / 2,
		halfV: mirror.d / 2,
		quaternion,
	};
}

function mirrorCorners(frame) {
	return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([su, sv]) => frame.center.clone()
		.addScaledVector(frame.axisU, su * frame.halfU)
		.addScaledVector(frame.axisV, sv * frame.halfV));
}

function deviceFrame(device) {
	// Projector and camera look along -Z; pan turns around Y, tilt around X
	const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(device.pitch * DEG, device.yaw * DEG, device.roll * DEG, 'YXZ'));
	const tanH = Math.tan((device.hFov / 2) * DEG);
	return {
		origin: new THREE.Vector3(device.x, device.y, device.z),
		forward: new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion),
		right: new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion),
		up: new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion),
		tanH,
		tanV: tanH / IMAGE_ASPECT,
		quaternion,
	};
}

/**
 * Direction of one pixel of a projector or camera image.
 * Pixel object: { frame, u, v } with u and v from -1 to 1
 */
function deviceRay(pixel) {
	const { frame, u, v } = pixel;
	return frame.forward.clone()
		.addScaledVector(frame.right, u * frame.tanH)
		.addScaledVector(frame.up, v * frame.tanV)
		.normalize();
}

/**
 * Nearest mirror a ray hits, and whether it hits the reflective face or the back.
 * Ray object: { origin, dir, frames, skipId }
 */
function nearestMirrorHit(ray) {
	let best = null;
	ray.frames.forEach((frame) => {
		if (frame.id === ray.skipId) {
			return;
		}
		const denominator = ray.dir.dot(frame.normal);
		if (Math.abs(denominator) < 1e-6) {
			return;
		}
		const distance = frame.center.clone().sub(ray.origin).dot(frame.normal) / denominator;
		if (distance <= 1e-4 || (best && distance >= best.distance)) {
			return;
		}
		const point = ray.origin.clone().addScaledVector(ray.dir, distance);
		const offset = point.clone().sub(frame.center);
		if (Math.abs(offset.dot(frame.axisU)) > frame.halfU || Math.abs(offset.dot(frame.axisV)) > frame.halfV) {
			return;
		}
		best = { id: frame.id, distance, point, front: denominator < 0, normal: frame.normal };
	});
	return best;
}

/**
 * Follows a ray through the mirrors until it reaches the floor.
 * Ray object: { origin, dir, frames }
 */
function traceRay(ray) {
	const points = [ray.origin.clone()];
	let origin = ray.origin.clone();
	let dir = ray.dir.clone();
	let skipId = null;
	let mirrorId = null;
	let mirrorPoint = null;
	for (let bounce = 0; bounce <= MAX_BOUNCES; bounce += 1) {
		const hit = nearestMirrorHit({ origin, dir, frames: ray.frames, skipId });
		const floorDistance = dir.y < -1e-6 ? -origin.y / dir.y : Infinity;
		if (hit && hit.distance < floorDistance) {
			points.push(hit.point);
			if (!hit.front) {
				return { points, floor: null, mirrorId, mirrorPoint, blocked: true };
			}
			mirrorId = mirrorId || hit.id;
			mirrorPoint = mirrorPoint || hit.point;
			dir = dir.clone().reflect(hit.normal);
			origin = hit.point;
			skipId = hit.id;
			continue;
		}
		if (floorDistance < MAX_RAY_LENGTH) {
			const floor = origin.clone().addScaledVector(dir, floorDistance);
			points.push(floor);
			return { points, floor, mirrorId, mirrorPoint, blocked: false };
		}
		points.push(origin.clone().addScaledVector(dir, 4));
		break;
	}
	return { points, floor: null, mirrorId, mirrorPoint, blocked: false };
}

function boundaryPixels() {
	// Walk the image edge: bottom, right, top, left
	const pixels = [];
	for (let i = 0; i < EDGE_SAMPLES; i += 1) pixels.push([-1 + (2 * i) / EDGE_SAMPLES, -1]);
	for (let i = 0; i < EDGE_SAMPLES; i += 1) pixels.push([1, -1 + (2 * i) / EDGE_SAMPLES]);
	for (let i = 0; i < EDGE_SAMPLES; i += 1) pixels.push([1 - (2 * i) / EDGE_SAMPLES, 1]);
	for (let i = 0; i < EDGE_SAMPLES; i += 1) pixels.push([-1, 1 - (2 * i) / EDGE_SAMPLES]);
	return pixels;
}

function seededRandom(seed) {
	let value = seed;
	return () => {
		value = (value * 16807) % 2147483647;
		return (value - 1) / 2147483646;
	};
}

/**
 * Point-in-triangle test on the floor plane (x, z).
 * Test object: { point: [x, z], triangle: [[x, z], [x, z], [x, z]] }
 */
function insideTriangle(test) {
	const [p, a, b, c] = [test.point, ...test.triangle];
	const side = (s, t) => (s[0] - p[0]) * (t[1] - p[1]) - (t[0] - p[0]) * (s[1] - p[1]);
	const d1 = side(a, b);
	const d2 = side(b, c);
	const d3 = side(c, a);
	return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

function insidePolygon(test) {
	// Even-odd rule on the floor plane; test object: { point: [x, z], polygon: [[x, z], ...] }
	const [x, z] = test.point;
	let inside = false;
	for (let i = 0, j = test.polygon.length - 1; i < test.polygon.length; j = i, i += 1) {
		const [xi, zi] = test.polygon[i];
		const [xj, zj] = test.polygon[j];
		if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) {
			inside = !inside;
		}
	}
	return inside;
}

function crowdSamples() {
	const { crowdW, crowdD } = state.setup.venue;
	const samples = [];
	for (let j = 0; j < CROWD_SAMPLES.rows; j += 1) {
		for (let i = 0; i < CROWD_SAMPLES.columns; i += 1) {
			samples.push([-crowdW / 2 + (crowdW * (i + 0.5)) / CROWD_SAMPLES.columns, -crowdD / 2 + (crowdD * (j + 0.5)) / CROWD_SAMPLES.rows]);
		}
	}
	return samples;
}

// Three.js scene

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewportEl.prepend(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.className = 'labels-layer';
viewportEl.append(labelRenderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.background);
scene.fog = new THREE.Fog(COLORS.background, 40, 90);

const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 200);
camera.position.set(...VIEW_PRESETS.perspective.position);

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.target.set(...VIEW_PRESETS.perspective.target);
orbit.maxPolarAngle = Math.PI * 0.495;

const transform = new TransformControls(camera, renderer.domElement);
transform.setSize(0.8);
scene.add(transform.getHelper());

scene.add(new THREE.HemisphereLight(0xc8c8ff, 0x101014, 1.2));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
keyLight.position.set(6, 12, 8);
scene.add(keyLight);

const parts = {
	venue: new THREE.Group(),
	crowd: new THREE.Group(),
	truss: new THREE.Group(),
	mirrors: new THREE.Group(),
	projector: new THREE.Group(),
	camera: new THREE.Group(),
	dj: new THREE.Group(),
	optics: new THREE.Group(),
	cables: new THREE.Group(),
	dimension: new THREE.Group(),
};
Object.values(parts).forEach((group) => scene.add(group));
parts.truss.userData.select = 'truss';
parts.projector.userData.select = 'projector';
parts.camera.userData.select = 'camera';
parts.dj.userData.select = 'dj';
parts.projector.rotation.order = 'YXZ';
parts.camera.rotation.order = 'YXZ';

const mirrorObjects = new Map();
let mountMesh = null;
let selectionBox = null;

const effectVideo = document.createElement('video');
effectVideo.src = EFFECT_CLIP;
effectVideo.muted = true;
effectVideo.loop = true;
effectVideo.playsInline = true;
effectVideo.autoplay = true;
effectVideo.play().catch(() => {});
const effectTexture = new THREE.VideoTexture(effectVideo);
effectTexture.colorSpace = THREE.SRGBColorSpace;

function material(settings) {
	return new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.1, ...settings });
}

function clearGroup(group) {
	while (group.children.length) {
		const child = group.children.pop();
		child.traverse((node) => {
			if (node.isCSS2DObject) node.element.remove();
			if (node.geometry) node.geometry.dispose();
			if (node.dispose) node.dispose();
		});
	}
}

function nameTag(text) {
	const element = document.createElement('div');
	element.className = 'tag3d';
	element.textContent = text;
	const tag = new CSS2DObject(element);
	tag.userData.isNameTag = true;
	return tag;
}

function buildVenue() {
	clearGroup(parts.venue);
	const { floorW, floorD, wallH, crowdW, crowdD } = state.setup.venue;
	const floor = new THREE.Mesh(new THREE.PlaneGeometry(floorW, floorD), material({ color: COLORS.floor, roughness: 0.95 }));
	floor.rotation.x = -Math.PI / 2;
	parts.venue.add(floor);

	// One-metre grid within the floor
	const grid = [];
	for (let x = Math.ceil(-floorW / 2); x <= floorW / 2; x += 1) grid.push(x, 0.002, -floorD / 2, x, 0.002, floorD / 2);
	for (let z = Math.ceil(-floorD / 2); z <= floorD / 2; z += 1) grid.push(-floorW / 2, 0.002, z, floorW / 2, 0.002, z);
	const gridGeometry = new THREE.BufferGeometry();
	gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(grid, 3));
	parts.venue.add(new THREE.LineSegments(gridGeometry, new THREE.LineBasicMaterial({ color: COLORS.grid })));

	const walls = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(floorW, wallH, floorD)), new THREE.LineBasicMaterial({ color: COLORS.walls }));
	walls.position.y = wallH / 2;
	parts.venue.add(walls);

	const area = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([
		new THREE.Vector3(-crowdW / 2, 0.01, -crowdD / 2), new THREE.Vector3(crowdW / 2, 0.01, -crowdD / 2),
		new THREE.Vector3(crowdW / 2, 0.01, crowdD / 2), new THREE.Vector3(-crowdW / 2, 0.01, crowdD / 2),
	]), new THREE.LineDashedMaterial({ color: 0x8a8a96, dashSize: 0.25, gapSize: 0.18 }));
	area.computeLineDistances();
	parts.venue.add(area);
	buildCrowd();
}

function buildCrowd() {
	clearGroup(parts.crowd);
	const { crowdW, crowdD, crowdCount, headHeight } = state.setup.venue;
	if (!crowdCount) return;
	const random = seededRandom(7);
	const bodyGeometry = new THREE.CylinderGeometry(0.17, 0.2, 1, 10).translate(0, 0.5, 0);
	const headGeometry = new THREE.SphereGeometry(0.12, 12, 10);
	const bodies = new THREE.InstancedMesh(bodyGeometry, material({ color: COLORS.person }), crowdCount);
	const heads = new THREE.InstancedMesh(headGeometry, material({ color: 0x77778a }), crowdCount);
	const matrix = new THREE.Matrix4();
	for (let i = 0; i < crowdCount; i += 1) {
		const x = (random() - 0.5) * crowdW;
		const z = (random() - 0.5) * crowdD;
		const height = headHeight + (random() - 0.5) * 0.25;
		matrix.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion(), new THREE.Vector3(1, height - 0.28, 1));
		bodies.setMatrixAt(i, matrix);
		matrix.compose(new THREE.Vector3(x, height - 0.12, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
		heads.setMatrixAt(i, matrix);
	}
	parts.crowd.add(bodies, heads);
	parts.crowd.visible = state.toggles.crowd;
}

/**
 * Adds one straight truss member (chord, lacing or tower post) as an instance matrix.
 * Member object: { list, start, end, thickness }
 */
function addMember(member) {
	const direction = member.end.clone().sub(member.start);
	const length = direction.length();
	if (length < 1e-4) return;
	const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
	member.list.push(new THREE.Matrix4().compose(member.start, quaternion, new THREE.Vector3(member.thickness, length, member.thickness)));
}

function trussSegment(segment) {
	// Box truss: four chords plus zig-zag lacing on each face; segment object: { list, a, b, size }
	const { list, a, b, size } = segment;
	const t = b.clone().sub(a).normalize();
	const reference = Math.abs(t.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
	const e1 = new THREE.Vector3().crossVectors(t, reference).normalize();
	const e2 = new THREE.Vector3().crossVectors(t, e1);
	const half = size / 2;
	const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([s1, s2]) => e1.clone().multiplyScalar(s1 * half).addScaledVector(e2, s2 * half));
	corners.forEach((corner) => addMember({ list, start: a.clone().add(corner), end: b.clone().add(corner), thickness: CHORD }));
	const length = a.distanceTo(b);
	const steps = Math.max(1, Math.round(length / size));
	for (let face = 0; face < 4; face += 1) {
		const ca = corners[face];
		const cb = corners[(face + 1) % 4];
		for (let k = 0; k < steps; k += 1) {
			const p0 = a.clone().addScaledVector(t, (length * k) / steps);
			const p1 = a.clone().addScaledVector(t, (length * (k + 1)) / steps);
			const [from, to] = k % 2 === 0 ? [p0.clone().add(ca), p1.clone().add(cb)] : [p0.clone().add(cb), p1.clone().add(ca)];
			addMember({ list, start: from, end: to, thickness: LACING });
		}
	}
}

function trussBeams() {
	// Beam centre lines in truss-local space, used for the members and the mounting points
	const { w, d, height, crossbeams } = state.setup.truss;
	const c = [new THREE.Vector3(-w / 2, height, -d / 2), new THREE.Vector3(w / 2, height, -d / 2), new THREE.Vector3(w / 2, height, d / 2), new THREE.Vector3(-w / 2, height, d / 2)];
	const beams = [
		{ name: 'back', a: c[0], b: c[1] },
		{ name: 'right', a: c[1], b: c[2] },
		{ name: 'front', a: c[2], b: c[3] },
		{ name: 'left', a: c[3], b: c[0] },
	];
	for (let i = 1; i <= crossbeams; i += 1) {
		const x = -w / 2 + (w * i) / (crossbeams + 1);
		beams.push({ name: `cross${i}`, a: new THREE.Vector3(x, height, -d / 2), b: new THREE.Vector3(x, height, d / 2) });
	}
	return beams;
}

function buildTruss() {
	clearGroup(parts.truss);
	const { height, size, towers } = state.setup.truss;
	const members = [];
	const beams = trussBeams();
	beams.forEach((beam) => trussSegment({ list: members, a: beam.a, b: beam.b, size }));
	if (towers) {
		beams.slice(0, 4).forEach((beam) => {
			const top = beam.a.clone().setY(height + size / 2);
			trussSegment({ list: members, a: top.clone().setY(0), b: top, size });
			members.push(new THREE.Matrix4().compose(top.clone().setY(0), new THREE.Quaternion(), new THREE.Vector3(0.6, 0.02, 0.6)));
		});
	}
	const memberGeometry = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
	const mesh = new THREE.InstancedMesh(memberGeometry, material({ color: COLORS.truss, metalness: 0.8, roughness: 0.35 }), members.length);
	members.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
	parts.truss.add(mesh);

	// Mounting points along the bottom of every beam
	state.mountPoints = [];
	beams.forEach((beam) => {
		const length = beam.a.distanceTo(beam.b);
		const count = Math.floor((length - MOUNT_SPACING) / MOUNT_SPACING) + 1;
		for (let k = 0; k < count; k += 1) {
			const along = MOUNT_SPACING / 2 + k * MOUNT_SPACING + (length - MOUNT_SPACING - (count - 1) * MOUNT_SPACING) / 2;
			const local = beam.a.clone().lerp(beam.b, along / length);
			local.y -= size / 2 + 0.03;
			state.mountPoints.push({ id: `${beam.name}:${k}`, local });
		}
	});
	mountMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }), state.mountPoints.length);
	mountMesh.userData.isMounts = true;
	state.mountPoints.forEach((point, index) => mountMesh.setMatrixAt(index, new THREE.Matrix4().makeTranslation(point.local.x, point.local.y, point.local.z)));
	parts.truss.add(mountMesh);
	if (state.setup.mounts === null) {
		autoMounts();
	}
	colourMounts();
	const tag = nameTag('Truss');
	tag.position.set(state.setup.truss.w / 2, height + 0.6, -state.setup.truss.d / 2);
	parts.truss.add(tag);
}

function colourMounts() {
	if (!mountMesh) return;
	const selected = new Set(state.setup.mounts || []);
	state.mountPoints.forEach((point, index) => mountMesh.setColorAt(index, new THREE.Color(selected.has(point.id) ? COLORS.mountOn : COLORS.mount)));
	mountMesh.instanceColor.needsUpdate = true;
}

function mountWorld(point) {
	return point.local.clone().add(new THREE.Vector3(state.setup.truss.x, 0, state.setup.truss.z));
}

function autoMounts(options = {}) {
	// Picks the mounting point closest (in plan) to every mirror corner; options: { mirrors, keep }
	const chosen = new Set(options.keep ? state.setup.mounts || [] : []);
	(options.mirrors || state.setup.mirrors).forEach((mirror) => {
		mirrorCorners(mirrorFrame(mirror)).forEach((corner) => {
			let best = null;
			state.mountPoints.forEach((point) => {
				const world = mountWorld(point);
				const distance = Math.hypot(world.x - corner.x, world.z - corner.z);
				if (!best || distance < best.distance) best = { id: point.id, distance };
			});
			if (best) chosen.add(best.id);
		});
	});
	state.setup.mounts = [...chosen];
}

function buildMirror(mirror) {
	const existing = mirrorObjects.get(mirror.id);
	if (existing) {
		parts.mirrors.remove(existing);
		clearGroup(existing);
	}
	const group = new THREE.Group();
	group.rotation.order = 'YXZ';
	group.userData.select = `mirror:${mirror.id}`;
	const size = new THREE.Vector2();
	renderer.getDrawingBufferSize(size);
	const reflector = new Reflector(new THREE.PlaneGeometry(mirror.w, mirror.d), {
		clipBias: 0.003,
		textureWidth: Math.max(256, Math.round(size.x * 0.6)),
		textureHeight: Math.max(256, Math.round(size.y * 0.6)),
		color: 0xb9c3cf,
	});
	reflector.rotation.x = Math.PI / 2;
	group.add(reflector);
	const backing = new THREE.Mesh(new THREE.BoxGeometry(mirror.w, 0.025, mirror.d), material({ color: 0x3a3a46, roughness: 0.7 }));
	backing.position.y = 0.016;
	group.add(backing);

	// Panel seams on the mirror face
	const seams = [];
	const columns = Math.max(1, Math.round(mirror.w / mirror.panel));
	const rows = Math.max(1, Math.round(mirror.d / mirror.panel));
	for (let i = 1; i < columns; i += 1) {
		const x = -mirror.w / 2 + (mirror.w * i) / columns;
		seams.push(x, -0.002, -mirror.d / 2, x, -0.002, mirror.d / 2);
	}
	for (let j = 1; j < rows; j += 1) {
		const z = -mirror.d / 2 + (mirror.d * j) / rows;
		seams.push(-mirror.w / 2, -0.002, z, mirror.w / 2, -0.002, z);
	}
	const seamGeometry = new THREE.BufferGeometry();
	seamGeometry.setAttribute('position', new THREE.Float32BufferAttribute(seams, 3));
	group.add(new THREE.LineSegments(seamGeometry, new THREE.LineBasicMaterial({ color: 0x0c0c10 })));
	const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(mirror.w, 0.03, mirror.d)), new THREE.LineBasicMaterial({ color: COLORS.beamOut, transparent: true, opacity: 0.7 }));
	outline.position.y = 0.012;
	group.add(outline);
	const tag = nameTag(mirrorName(mirror));
	tag.position.set(-mirror.w / 2, 0.35, -mirror.d / 2);
	group.add(tag);
	parts.mirrors.add(group);
	mirrorObjects.set(mirror.id, group);
}

function buildMirrors() {
	const ids = new Set(state.setup.mirrors.map((mirror) => mirror.id));
	[...mirrorObjects.keys()].forEach((id) => {
		if (!ids.has(id)) {
			const group = mirrorObjects.get(id);
			parts.mirrors.remove(group);
			clearGroup(group);
			mirrorObjects.delete(id);
		}
	});
	state.setup.mirrors.forEach((mirror) => buildMirror(mirror));
}

function buildDevice(device) {
	// Small projector or camera body with its lens facing -Z; device object: { group, size, colour, name, tagBelow }
	clearGroup(device.group);
	const [w, h, d] = device.size;
	const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material({ color: device.colour, metalness: 0.3, roughness: 0.4 }));
	const lens = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.32, h * 0.32, 0.06, 20), material({ color: 0x0b0b0e, metalness: 0.6, roughness: 0.2 }));
	lens.rotation.x = Math.PI / 2;
	lens.position.set(0, 0, -d / 2 - 0.03);
	device.group.add(body, lens);
	const tag = nameTag(device.name);
	tag.position.set(0, device.tagBelow ? -h / 2 - 0.3 : h / 2 + 0.3, 0);
	device.group.add(tag);
}

function buildDj() {
	clearGroup(parts.dj);
	const { riser } = state.setup.dj;
	const dark = material({ color: 0x1d1d24, roughness: 0.8 });
	const boxes = [
		{ size: [3.2, riser, 2.0], pos: [0, riser / 2, 0] },
		{ size: [2.4, 0.95, 0.7], pos: [0, riser + 0.475, 0.55] },
		{ size: [0.34, 0.1, 0.4], pos: [-0.6, riser + 1.0, 0.55] },
		{ size: [0.34, 0.1, 0.4], pos: [0.6, riser + 1.0, 0.55] },
		{ size: [0.32, 0.09, 0.38], pos: [0, riser + 0.995, 0.55] },
		{ size: [0.7, 1.6, 0.7], pos: [-2.3, 0.8, 0.3] },
		{ size: [0.7, 1.6, 0.7], pos: [2.3, 0.8, 0.3] },
	];
	boxes.filter((box) => box.size[1] > 0.001).forEach((box) => {
		const mesh = new THREE.Mesh(new THREE.BoxGeometry(...box.size), dark);
		mesh.position.set(...box.pos);
		parts.dj.add(mesh);
	});
	const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 1.45, 10), material({ color: COLORS.beamIn }));
	body.position.set(0, riser + 0.725, -0.25);
	const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), material({ color: COLORS.beamIn }));
	head.position.set(0, riser + 1.6, -0.25);
	parts.dj.add(body, head);
	const tag = nameTag('DJ');
	tag.position.set(0, riser + 2.1, 0);
	parts.dj.add(tag);
}

function syncTransforms() {
	// Places every object from the setup data, except the one being dragged
	const dragged = transform.dragging ? transform.object : null;
	const { setup } = state;
	[['projector', parts.projector], ['camera', parts.camera]].forEach(([key, group]) => {
		if (group === dragged) return;
		const device = setup[key];
		group.position.set(device.x, device.y, device.z);
		group.rotation.set(device.pitch * DEG, device.yaw * DEG, device.roll * DEG, 'YXZ');
	});
	if (parts.dj !== dragged) {
		parts.dj.position.set(setup.dj.x, 0, setup.dj.z);
		parts.dj.rotation.set(0, setup.dj.yaw * DEG, 0);
	}
	if (parts.truss !== dragged) {
		parts.truss.position.set(setup.truss.x, 0, setup.truss.z);
	}
	setup.mirrors.forEach((mirror) => {
		const group = mirrorObjects.get(mirror.id);
		if (!group || group === dragged) return;
		group.position.set(mirror.x, mirror.y, mirror.z);
		group.rotation.set(-mirror.tilt * DEG, mirror.yaw * DEG, mirror.roll * DEG, 'YXZ');
		group.scale.set(1, 1, 1);
	});
}

// Optics: the projector beam and the camera view, traced through the mirrors

function lineSegmentsFrom(segments) {
	// Segments object: { positions, colours, opacity, dashed }
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(segments.positions, 3));
	if (segments.colours) {
		geometry.setAttribute('color', new THREE.Float32BufferAttribute(segments.colours, 3));
	}
	const lineMaterial = segments.dashed
		? new THREE.LineDashedMaterial({ color: COLORS.camera, dashSize: 0.18, gapSize: 0.12, transparent: true, opacity: segments.opacity })
		: new THREE.LineBasicMaterial({ vertexColors: Boolean(segments.colours), color: segments.colours ? 0xffffff : COLORS.camera, transparent: true, opacity: segments.opacity, depthWrite: false });
	const lines = new THREE.LineSegments(geometry, lineMaterial);
	if (segments.dashed) lines.computeLineDistances();
	return lines;
}

function traceProjector(frames) {
	const frame = deviceFrame(state.setup.projector);
	const grid = [];
	for (let j = 0; j <= RAY_ROWS; j += 1) {
		const row = [];
		for (let i = 0; i <= RAY_COLUMNS; i += 1) {
			const u = -1 + (2 * i) / RAY_COLUMNS;
			const v = -1 + (2 * j) / RAY_ROWS;
			row.push(traceRay({ origin: frame.origin, dir: deviceRay({ frame, u, v }), frames }));
		}
		grid.push(row);
	}
	return { frame, grid, centre: traceRay({ origin: frame.origin, dir: frame.forward, frames }), edge: boundaryPixels().map(([u, v]) => traceRay({ origin: frame.origin, dir: deviceRay({ frame, u, v }), frames })) };
}

function floorImage(grid) {
	// Textures the projected effect onto the floor where the rays land, cell by cell
	const positions = [];
	const uvs = [];
	const colours = [];
	const triangles = [];
	const lift = 0.015;
	for (let j = 0; j < RAY_ROWS; j += 1) {
		for (let i = 0; i < RAY_COLUMNS; i += 1) {
			const cell = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([ci, cj]) => ({ ci, cj, hit: grid[cj][ci] }));
			const first = cell[0].hit;
			if (cell.some((corner) => !corner.hit.floor || corner.hit.mirrorId !== first.mirrorId)) continue;
			const tint = first.mirrorId ? 1 : 0.45;
			[[0, 1, 2], [0, 2, 3]].forEach((order) => {
				const corners = order.map((index) => cell[index]);
				corners.forEach((corner) => {
					positions.push(corner.hit.floor.x, lift, corner.hit.floor.z);
					uvs.push(corner.ci / RAY_COLUMNS, corner.cj / RAY_ROWS);
					colours.push(tint, tint, tint);
				});
				if (first.mirrorId) {
					const points = corners.map((corner) => [corner.hit.floor.x, corner.hit.floor.z]);
					const xs = points.map((p) => p[0]);
					const zs = points.map((p) => p[1]);
					triangles.push({ points, box: [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)] });
				}
			});
		}
	}
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
	geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
	const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: effectTexture, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
	return { mesh, triangles };
}

function beamLines(projection) {
	// A sparse set of rays: lilac up to the mirror, cyan after the bounce
	const positions = [];
	const colours = [];
	const inColour = new THREE.Color(COLORS.beamIn);
	const outColour = new THREE.Color(COLORS.beamOut);
	const pick = (count) => [...new Set([...Array(Math.floor(count / LINE_STEP) + 1).keys()].map((k) => k * LINE_STEP).concat(count))];
	pick(RAY_ROWS).forEach((j) => pick(RAY_COLUMNS).forEach((i) => {
		const { points } = projection.grid[j][i];
		for (let k = 0; k < points.length - 1; k += 1) {
			const colour = k === 0 ? inColour : outColour;
			positions.push(points[k].x, points[k].y, points[k].z, points[k + 1].x, points[k + 1].y, points[k + 1].z);
			colours.push(colour.r, colour.g, colour.b, colour.r, colour.g, colour.b);
		}
	}));
	return lineSegmentsFrom({ positions, colours, opacity: 0.35 });
}

function mirrorImageOutline(edge) {
	// Where the edge of the projected image lands on the mirrors
	const positions = [];
	edge.forEach((hit, index) => {
		const next = edge[(index + 1) % edge.length];
		if (hit.mirrorPoint && next.mirrorPoint && hit.mirrorId === next.mirrorId) {
			positions.push(hit.mirrorPoint.x, hit.mirrorPoint.y, hit.mirrorPoint.z, next.mirrorPoint.x, next.mirrorPoint.y, next.mirrorPoint.z);
		}
	});
	const lines = lineSegmentsFrom({ positions, opacity: 1 });
	lines.material.color.set(COLORS.beamOut);
	return lines;
}

function traceCamera(frames) {
	const frame = deviceFrame(state.setup.camera);
	const edge = boundaryPixels().map(([u, v]) => traceRay({ origin: frame.origin, dir: deviceRay({ frame, u, v }), frames }));
	const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => traceRay({ origin: frame.origin, dir: deviceRay({ frame, u, v }), frames }));
	return { frame, edge, corners, centre: traceRay({ origin: frame.origin, dir: frame.forward, frames }) };
}

function cameraLines(view) {
	const footprint = [];
	view.edge.forEach((hit, index) => {
		const next = view.edge[(index + 1) % view.edge.length];
		if (hit.floor && next.floor) footprint.push(hit.floor.x, 0.03, hit.floor.z, next.floor.x, 0.03, next.floor.z);
	});
	const frustum = [];
	view.corners.forEach((hit) => {
		for (let k = 0; k < hit.points.length - 1; k += 1) {
			frustum.push(hit.points[k].x, hit.points[k].y, hit.points[k].z, hit.points[k + 1].x, hit.points[k + 1].y, hit.points[k + 1].z);
		}
	});
	const group = new THREE.Group();
	group.add(lineSegmentsFrom({ positions: footprint, opacity: 0.85, dashed: true }));
	group.add(lineSegmentsFrom({ positions: frustum, opacity: 0.22 }));
	return group;
}

function updateOptics() {
	clearGroup(parts.optics);
	const frames = state.setup.mirrors.map(mirrorFrame);
	const projection = traceProjector(frames);
	const image = floorImage(projection.grid);
	const view = traceCamera(frames);

	const beam = new THREE.Group();
	beam.add(image.mesh, beamLines(projection), mirrorImageOutline(projection.edge));
	beam.visible = state.toggles.beam;
	parts.optics.add(beam);
	const cameraView = cameraLines(view);
	cameraView.visible = state.toggles.cameraView;
	parts.optics.add(cameraView);

	state.metrics = opticsMetrics({ projection, image, view, frames });
}

function opticsMetrics(input) {
	// Numbers for the measurements panel; input object: { projection, image, view, frames }
	const { projection, image, view, frames } = input;
	const rays = projection.grid.flat();
	const viaMirror = rays.filter((hit) => hit.mirrorId && hit.floor);
	const blocked = rays.filter((hit) => hit.blocked).length / rays.length;
	const onMirror = rays.filter((hit) => hit.mirrorId && !hit.blocked).length / rays.length;
	const floorXs = viaMirror.map((hit) => hit.floor.x);
	const floorZs = viaMirror.map((hit) => hit.floor.z);
	const footprint = viaMirror.length ? { w: Math.max(...floorXs) - Math.min(...floorXs), d: Math.max(...floorZs) - Math.min(...floorZs), cx: (Math.max(...floorXs) + Math.min(...floorXs)) / 2, cz: (Math.max(...floorZs) + Math.min(...floorZs)) / 2 } : null;
	const area = image.triangles.reduce((sum, { points: [a, b, c] }) => sum + Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2, 0);

	const samples = crowdSamples();
	const lit = samples.filter((point) => image.triangles.some(({ points, box }) => point[0] >= box[0] && point[0] <= box[1] && point[1] >= box[2] && point[1] <= box[3] && insideTriangle({ point, triangle: points })));
	const cameraPolygon = view.edge.filter((hit) => hit.floor).map((hit) => [hit.floor.x, hit.floor.z]);
	const seen = cameraPolygon.length > 2 ? samples.filter((point) => insidePolygon({ point, polygon: cameraPolygon })) : [];
	const seenViaMirror = view.edge.filter((hit) => hit.mirrorId).length / view.edge.length;
	const cameraCentre = cameraPolygon.length ? cameraPolygon.reduce((sum, [x, z]) => [sum[0] + x / cameraPolygon.length, sum[1] + z / cameraPolygon.length], [0, 0]) : null;

	// Size of the projected image on the mirror it hits first
	let mirrorImage = null;
	const centreFrame = frames.find((frame) => frame.id === projection.centre.mirrorId);
	if (centreFrame) {
		const local = projection.edge.filter((hit) => hit.mirrorId === centreFrame.id && hit.mirrorPoint).map((hit) => {
			const offset = hit.mirrorPoint.clone().sub(centreFrame.center);
			return [offset.dot(centreFrame.axisU), offset.dot(centreFrame.axisV)];
		});
		if (local.length) {
			mirrorImage = { w: Math.max(...local.map((p) => p[0])) - Math.min(...local.map((p) => p[0])), d: Math.max(...local.map((p) => p[1])) - Math.min(...local.map((p) => p[1])) };
		}
	}
	const centre = projection.centre;
	const toMirror = centre.mirrorPoint ? centre.mirrorPoint.distanceTo(projection.frame.origin) : null;
	const toFloor = centre.floor && centre.mirrorPoint ? centre.floor.distanceTo(centre.mirrorPoint) : null;
	const lumensOnFloor = state.setup.projector.lumens * onMirror * MIRROR_REFLECTANCE;
	return {
		blocked,
		onMirror,
		footprint,
		area,
		lux: area > 0 ? lumensOnFloor / area : null,
		crowdLit: samples.length ? lit.length / samples.length : 0,
		crowdSeen: samples.length ? seen.length / samples.length : 0,
		seenViaMirror,
		alignment: footprint && cameraCentre ? Math.hypot(footprint.cx - cameraCentre[0], footprint.cz - cameraCentre[1]) : null,
		mirrorImage,
		toMirror,
		toFloor,
		aimPoint: centre.mirrorPoint || projection.frame.origin.clone().addScaledVector(projection.frame.forward, 5),
		cameraAim: view.centre.mirrorPoint || view.frame.origin.clone().addScaledVector(view.frame.forward, 5),
	};
}

// Cables from the selected mounting points to the mirror corners

function updateCables() {
	clearGroup(parts.cables);
	state.cables = [];
	const selected = new Set(state.setup.mounts || []);
	const mounts = state.mountPoints.filter((point) => selected.has(point.id)).map((point) => ({ id: point.id, world: mountWorld(point) }));
	if (!mounts.length) return;
	const positions = [];
	state.setup.mirrors.forEach((mirror) => {
		mirrorCorners(mirrorFrame(mirror)).forEach((corner, index) => {
			let best = null;
			mounts.forEach((mount) => {
				const distance = mount.world.distanceTo(corner);
				if (!best || distance < best.distance) best = { ...mount, distance };
			});
			const vertical = best.world.y - corner.y;
			state.cables.push({ mirror: mirrorName(mirror), corner: index + 1, mount: best.id, length: best.distance, angle: Math.acos(Math.min(1, Math.max(-1, vertical / best.distance))) / DEG, upward: vertical > 0 });
			positions.push(best.world.x, best.world.y, best.world.z, corner.x, corner.y, corner.z);
		});
	});
	const lines = lineSegmentsFrom({ positions, opacity: 0.9 });
	lines.material.color.set(COLORS.cable);
	parts.cables.add(lines);
}

// Dimension line for the selected object

function heightReference() {
	const { type, data } = selectionData();
	if (type === 'projector' || type === 'camera') {
		return { point: new THREE.Vector3(data.x, data.y, data.z), label: `h ${metres(data.y)}` };
	}
	if (type === 'mirror') {
		const corners = mirrorCorners(mirrorFrame(data));
		const lowest = corners.reduce((low, corner) => (corner.y < low.y ? corner : low));
		return { point: lowest, label: `onderkant ${metres(lowest.y)}` };
	}
	if (type === 'truss') {
		return { point: new THREE.Vector3(data.x + data.w / 2, data.height, data.z + data.d / 2), label: `h ${metres(data.height)}` };
	}
	return null;
}

function updateDimension() {
	clearGroup(parts.dimension);
	const reference = heightReference();
	if (!reference) return;
	const { point } = reference;
	const line = lineSegmentsFrom({ positions: [point.x, 0, point.z, point.x, point.y, point.z], opacity: 0.9 });
	line.material.color.set(COLORS.beamIn);
	parts.dimension.add(line);
	const element = document.createElement('div');
	element.className = 'tag3d dim';
	element.textContent = reference.label;
	const label = new CSS2DObject(element);
	label.position.set(point.x, point.y / 2, point.z);
	parts.dimension.add(label);
}

// Measurements and warnings

function measureGroup(group) {
	// Group object: { title, rows: [[label, value], ...] }
	const rows = group.rows.map(([label, value]) => `<div class="measure-row"><span>${label}</span><span>${value}</span></div>`).join('');
	return `<div class="measure-group"><h3>${group.title}</h3>${rows}</div>`;
}

function trussLength() {
	const { w, d, height, size, crossbeams, towers } = state.setup.truss;
	return 2 * (w + d) + crossbeams * d + (towers ? 4 * (height + size / 2) : 0);
}

function updateMeasurements() {
	const { setup, metrics } = state;
	const { projector, camera, truss, venue, dj } = setup;
	const throwRatio = 1 / (2 * Math.tan((projector.hFov / 2) * DEG));
	const groups = [];
	groups.push({ title: 'Projector', rows: [
		['Height', metres(projector.y)],
		['Throw ratio', fmt(throwRatio)],
		['Distance to mirror (centre)', metrics.toMirror ? metres(metrics.toMirror) : 'misses the mirror'],
		['Mirror to floor (centre)', metrics.toFloor ? metres(metrics.toFloor) : '–'],
		['Image on mirror', metrics.mirrorImage ? `${fmt(metrics.mirrorImage.w)} × ${fmt(metrics.mirrorImage.d)} m` : '–'],
		['Image on floor', metrics.footprint ? `${fmt(metrics.footprint.w)} × ${fmt(metrics.footprint.d)} m` : '–'],
		['Beam on the mirror', percent(metrics.onMirror)],
		['Crowd area lit via mirror', percent(metrics.crowdLit)],
		['Light on floor (approx.)', metrics.lux ? `${fmt(metrics.lux, 0)} lux` : '–'],
	] });
	groups.push({ title: 'Camera', rows: [
		['Height', metres(camera.y)],
		['View via mirror', percent(metrics.seenViaMirror)],
		['Crowd area in view', percent(metrics.crowdSeen)],
		['Offset to projected image', metrics.alignment !== null ? metres(metrics.alignment) : '–'],
	] });
	setup.mirrors.forEach((mirror) => {
		const corners = mirrorCorners(mirrorFrame(mirror));
		const heights = corners.map((corner) => corner.y);
		const area = mirror.w * mirror.d;
		groups.push({ title: mirrorName(mirror), rows: [
			['Centre height', metres(mirror.y)],
			['Lowest / highest edge', `${fmt(Math.min(...heights))} / ${fmt(Math.max(...heights))} m`],
			['Clearance over raised hands', metres(Math.min(...heights) - (venue.headHeight + ARMS_UP))],
			['Size', `${fmt(mirror.w)} × ${fmt(mirror.d)} m (${fmt(area, 1)} m²)`],
			['Panels', `${Math.max(1, Math.round(mirror.w / mirror.panel))} × ${Math.max(1, Math.round(mirror.d / mirror.panel))}`],
			['Weight acrylic 3 mm / glass 4 mm', `${fmt(area * ACRYLIC_KG_PER_M2, 0)} / ${fmt(area * GLASS_KG_PER_M2, 0)} kg`],
		] });
	});
	const longest = state.cables.reduce((max, cable) => Math.max(max, cable.length), 0);
	groups.push({ title: 'Truss and rigging', rows: [
		['Frame', `${fmt(truss.w)} × ${fmt(truss.d)} m at ${metres(truss.height)}`],
		['Total truss length', metres(trussLength())],
		['Mounting points', `${(setup.mounts || []).length} selected`],
		['Cables', state.cables.length ? `${state.cables.length}, longest ${metres(longest)}` : 'none'],
		...state.cables.map((cable) => [`${cable.mirror} corner ${cable.corner}`, `${metres(cable.length)} · ${fmt(cable.angle, 0)}°`]),
	] });
	groups.push({ title: 'DJ', rows: [
		['Position', `${fmt(dj.x)} / ${fmt(dj.z)} m`],
		['Distance to crowd area', metres(Math.max(0, -venue.crowdD / 2 - (dj.z + 1)))],
	] });
	measureEl.innerHTML = groups.map(measureGroup).join('');
	warningsEl.innerHTML = collectWarnings().map((text) => `<li>${text}</li>`).join('');
}

function collectWarnings() {
	const { setup, metrics } = state;
	const warnings = [];
	const handsUp = setup.venue.headHeight + ARMS_UP;
	setup.mirrors.forEach((mirror) => {
		const heights = mirrorCorners(mirrorFrame(mirror)).map((corner) => corner.y);
		if (Math.min(...heights) < handsUp) {
			warnings.push(`${mirrorName(mirror)} hangs as low as ${metres(Math.min(...heights))}. Raised hands reach about ${metres(handsUp)}.`);
		}
		if (Math.max(...heights) > setup.truss.height - setup.truss.size / 2) {
			warnings.push(`${mirrorName(mirror)} reaches above the bottom of the truss frame.`);
		}
	});
	if (metrics.blocked > 0.02) warnings.push(`${percent(metrics.blocked)} of the beam hits the back of a mirror.`);
	if (metrics.onMirror < 0.5) warnings.push(`Only ${percent(metrics.onMirror)} of the beam reaches a mirror.`);
	if (metrics.seenViaMirror < 0.5) warnings.push('The camera sees less than half of its view via the mirror.');
	if (setup.mirrors.length && !(setup.mounts || []).length) warnings.push('No mounting points selected: select the truss and click the dots on it.');
	state.cables.filter((cable) => (cable.angle > 20 && cable.length > SHORT_SLING) || !cable.upward).forEach((cable) => warnings.push(`${cable.mirror} corner ${cable.corner}: the cable runs ${cable.upward ? `${fmt(cable.angle, 0)}° off vertical` : 'downwards'}.`));
	const inCrowd = (device) => Math.abs(device.x) < setup.venue.crowdW / 2 && Math.abs(device.z) < setup.venue.crowdD / 2 && device.y < 2.5;
	if (inCrowd(setup.projector)) warnings.push('The projector stands inside the crowd area at head height.');
	if (setup.dj.z + 1 > -setup.venue.crowdD / 2 && Math.abs(setup.dj.z) < setup.venue.crowdD / 2 + 1) warnings.push('The DJ booth overlaps the crowd area.');
	return warnings;
}

// Export for TouchDesigner

function exportData() {
	const { setup, metrics } = state;
	const mirror = setup.mirrors[0];
	const notes = [];
	const extraMirrors = setup.mirrors.length - 1;
	if (extraMirrors > 0) notes.push(`The TouchDesigner Previz has one mirror; Mirror 1 is exported, the other ${extraMirrors === 1 ? 'one is' : `${extraMirrors} are`} in "setup".`);
	if (mirror && (Math.abs(mirror.yaw) > 0.05 || Math.abs(mirror.roll) > 0.05)) notes.push('The Previz mirror only tilts; rotation and roll of Mirror 1 are not exported.');
	const frame = mirror ? mirrorFrame(mirror) : null;
	const halfX = frame ? Math.max(...mirrorCorners(frame).map((corner) => Math.abs(corner.x - mirror.x))) : 0;
	const trussClear = Math.max(0, setup.truss.w / 2 - halfX - setup.truss.size / 2);
	if (mirror && (Math.abs(setup.truss.x - mirror.x) > 0.05 || Math.abs(setup.truss.z - mirror.z) > 0.05)) notes.push('The Previz centres the truss on the mirror; the truss offset is only in "setup".');
	notes.push('The Previz places the DJ booth in front of the crowd area itself; the DJ position is only in "setup".');

	const projector = setup.projector;
	const camera = setup.camera;
	const sameRig = Math.hypot(camera.x - projector.x, camera.y - projector.y, camera.z - projector.z) < SAME_RIG_DISTANCE
		&& deviceFrame(camera).forward.angleTo(deviceFrame(projector).forward) / DEG < SAME_RIG_ANGLE;
	const r3 = (vector) => [round(vector.x, 3), round(vector.y, 3), round(vector.z, 3)];
	const previz = {
		Floorsize: [setup.venue.floorW, setup.venue.floorD],
		Wallheight: setup.venue.wallH,
		Crowdarea: [setup.venue.crowdW, setup.venue.crowdD],
		Crowdcount: setup.venue.crowdCount,
		Projpos: [projector.x, projector.y, projector.z],
		Projaim: r3(metrics.aimPoint),
		Projfov: projector.hFov,
		Videocam: sameRig ? 'mirror' : 'direct',
		Videocampos: [camera.x, camera.y, camera.z],
		Videocamaim: r3(metrics.cameraAim),
		Trusssize: setup.truss.size,
		Trussclear: round(trussClear, 3),
	};
	if (mirror) {
		Object.assign(previz, { Mirrorcover: 0, Mirrorpos: [mirror.x, mirror.y, mirror.z], Mirrorsize: [mirror.w, mirror.d], Mirrortilt: mirror.tilt, Mirrorpanel: mirror.panel });
	}
	return {
		generator: 'Bossche Boiler setup configurator',
		units: 'metres and degrees; x left/right, y up, z towards the projector (DJ at -z)',
		touchdesigner: { comp: '/project1/Previz', parameters: previz },
		setup,
		cables: state.cables.map((cable) => ({ ...cable, length: round(cable.length, 3), angle: round(cable.angle, 1) })),
		notes,
	};
}

function tdScript(data) {
	// Python for the TouchDesigner Textport that sets the Previz parameters
	const lines = ['# Bossche Boiler setup configurator: paste into the TouchDesigner Textport', `P = op('${data.touchdesigner.comp}')`];
	Object.entries(data.touchdesigner.parameters).forEach(([name, value]) => {
		if (Array.isArray(value)) {
			const suffixes = value.length === 2 ? ['x', 'y'] : ['x', 'y', 'z'];
			value.forEach((component, index) => lines.push(`P.par.${name}${suffixes[index]} = ${component}`));
		} else {
			lines.push(`P.par.${name} = ${typeof value === 'string' ? `'${value}'` : value}`);
		}
	});
	data.notes.forEach((note) => lines.push(`# ${note}`));
	return lines.join('\n');
}

function showToast(text) {
	toastEl.textContent = text;
	toastEl.classList.add('on');
	clearTimeout(showToast.timer);
	showToast.timer = setTimeout(() => toastEl.classList.remove('on'), 2400);
}

async function copyText(text) {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch (error) {
		const area = document.createElement('textarea');
		area.value = text;
		document.body.append(area);
		area.select();
		const copied = document.execCommand('copy');
		area.remove();
		return copied;
	}
}

function downloadJson(data) {
	const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
	const link = document.createElement('a');
	link.href = URL.createObjectURL(blob);
	link.download = 'bossche-boiler-setup.json';
	link.click();
	setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

// Panel UI

function renderObjectList() {
	const entries = [['projector', 'Projector'], ['camera', 'Camera'], ['truss', 'Truss'], ['dj', 'DJ'], ['venue', 'Venue']]
		.concat(state.setup.mirrors.map((mirror) => [`mirror:${mirror.id}`, mirrorName(mirror)]));
	objectListEl.innerHTML = '';
	entries.forEach(([key, label]) => {
		const button = document.createElement('button');
		button.className = 'btn';
		button.textContent = label;
		button.setAttribute('aria-pressed', String(state.selection === key));
		button.addEventListener('click', () => select(key));
		objectListEl.append(button);
	});
	document.getElementById('btnDelete').disabled = !selectedMirror() || state.setup.mirrors.length < 2;
}

function renderProps() {
	const { type, data, name } = selectionData();
	propsTitleEl.textContent = name;
	propsEl.innerHTML = '';
	FIELDS[type].forEach((field) => {
		if (field.section) {
			const heading = document.createElement('div');
			heading.className = 'prop-section';
			heading.textContent = field.section;
			propsEl.append(heading);
			return;
		}
		if (field.type === 'check') {
			const label = document.createElement('label');
			label.className = 'prop-check';
			label.innerHTML = `<input type="checkbox" data-key="${field.key}" ${data[field.key] ? 'checked' : ''}>${field.label}`;
			propsEl.append(label);
			return;
		}
		const row = document.createElement('div');
		row.className = 'prop';
		const id = `prop-${field.key}`;
		row.innerHTML = `<label for="${id}">${field.label}</label><input type="number" id="${id}" data-key="${field.key}" step="${field.step}" ${field.min !== undefined ? `min="${field.min}"` : ''} ${field.max !== undefined ? `max="${field.max}"` : ''} value="${data[field.key]}"><span class="unit">${field.unit}</span>`;
		propsEl.append(row);
	});
	if (type === 'truss') {
		const help = document.createElement('p');
		help.className = 'prop-help';
		help.textContent = 'Ophangpunten: klik de bolletjes op de truss in het 3D-beeld. Goud is gekozen.';
		propsEl.append(help);
		const row = document.createElement('div');
		row.className = 'side-row';
		row.innerHTML = '<button class="btn" id="btnAutoMounts">Pick for mirrors</button><button class="btn" id="btnClearMounts">Clear points</button>';
		propsEl.append(row);
		document.getElementById('btnAutoMounts').addEventListener('click', () => {
			autoMounts();
			refresh({});
		});
		document.getElementById('btnClearMounts').addEventListener('click', () => {
			state.setup.mounts = [];
			refresh({});
		});
	}
	if (type === 'projector') {
		const help = document.createElement('p');
		help.className = 'prop-help';
		help.textContent = 'Throw ratio = afstand ÷ beeldbreedte. Zoek de projector op die ratio uit; de worphoek volgt eruit.';
		propsEl.append(help);
	}
}

function updatePropInputs() {
	const { data } = selectionData();
	propsEl.querySelectorAll('input[data-key]').forEach((input) => {
		if (document.activeElement === input) return;
		if (input.type === 'checkbox') input.checked = Boolean(data[input.dataset.key]);
		else input.value = data[input.dataset.key];
	});
}

function rebuildScopeFor(type) {
	if (type === 'venue') return { venue: true };
	if (type === 'truss') return { truss: true };
	if (type === 'mirror') return { mirrors: true };
	if (type === 'dj') return { dj: true };
	return {};
}

propsEl.addEventListener('change', (event) => {
	const input = event.target.closest('input[data-key]');
	if (!input) return;
	const { type, data } = selectionData();
	const key = input.dataset.key;
	if (input.type === 'checkbox') {
		data[key] = input.checked;
	} else {
		const value = Number(input.value);
		if (Number.isNaN(value)) return;
		data[key] = WHOLE_NUMBER_KEYS.has(key) ? Math.max(0, Math.round(value)) : value;
	}
	refresh(rebuildScopeFor(type));
});

// Selection and the gizmo

function selectedObject3D() {
	const mirror = selectedMirror();
	if (mirror) return mirrorObjects.get(mirror.id);
	return { projector: parts.projector, camera: parts.camera, truss: parts.truss, dj: parts.dj }[state.selection] || null;
}

function configureGizmo() {
	const target = selectedObject3D();
	const { type } = selectionData();
	if (!target) {
		transform.detach();
		return;
	}
	let mode = state.mode;
	if (type === 'truss') mode = 'translate';
	if (mode === 'scale' && type !== 'mirror') mode = 'translate';
	transform.setMode(mode);
	transform.attach(target);
	transform.setSpace(mode === 'translate' ? 'world' : 'local');
	transform.showX = true;
	transform.showY = !((type === 'truss' || type === 'dj') && mode === 'translate') && mode !== 'scale';
	transform.showZ = true;
	if (type === 'dj' && mode === 'rotate') {
		transform.showX = false;
		transform.showZ = false;
	}
	transform.setTranslationSnap(state.toggles.snap ? 0.05 : null);
	transform.setRotationSnap(state.toggles.snap ? 5 * DEG : null);
	transform.setScaleSnap(state.toggles.snap ? 0.05 : null);
	document.querySelectorAll('[data-mode]').forEach((button) => {
		const buttonMode = button.dataset.mode;
		button.disabled = (type === 'truss' && buttonMode !== 'translate') || (buttonMode === 'scale' && type !== 'mirror');
		button.setAttribute('aria-pressed', String(buttonMode === mode));
	});
}

function select(key) {
	state.selection = key;
	const { type } = selectionData();
	hintEl.textContent = HINTS[type];
	renderObjectList();
	renderProps();
	configureGizmo();
	updateSelectionBox();
	updateDimension();
}

function updateSelectionBox() {
	if (selectionBox) {
		scene.remove(selectionBox);
		selectionBox.geometry.dispose();
		selectionBox = null;
	}
	const target = selectedObject3D();
	if (target && state.selection !== 'truss') {
		selectionBox = new THREE.BoxHelper(target, COLORS.selection);
		selectionBox.material.transparent = true;
		selectionBox.material.opacity = 0.6;
		scene.add(selectionBox);
	}
}

function readBack(object) {
	// Copies a gizmo edit back into the setup data
	const { type, data } = selectionData();
	const p = object.position;
	const r = object.rotation;
	if (type === 'projector' || type === 'camera') {
		Object.assign(data, { x: round(p.x, 3), y: round(Math.max(0, p.y), 3), z: round(p.z, 3), pitch: round(r.x / DEG, 1), yaw: round(r.y / DEG, 1), roll: round(r.z / DEG, 1) });
	} else if (type === 'mirror') {
		Object.assign(data, { x: round(p.x, 3), y: round(p.y, 3), z: round(p.z, 3), tilt: round(-r.x / DEG, 1), yaw: round(r.y / DEG, 1), roll: round(r.z / DEG, 1) });
	} else if (type === 'truss') {
		Object.assign(data, { x: round(p.x, 3), z: round(p.z, 3) });
		object.position.y = 0;
	} else if (type === 'dj') {
		Object.assign(data, { x: round(p.x, 3), z: round(p.z, 3), yaw: round(r.y / DEG, 1) });
		object.position.y = 0;
	}
}

transform.addEventListener('dragging-changed', (event) => {
	orbit.enabled = !event.value;
	const mirror = selectedMirror();
	if (!event.value && mirror && transform.mode === 'scale') {
		// Bake the scale into the mirror size, then rebuild it at scale 1
		const group = mirrorObjects.get(mirror.id);
		mirror.w = round(Math.max(0.2, mirror.w * Math.abs(group.scale.x)), 2);
		mirror.d = round(Math.max(0.2, mirror.d * Math.abs(group.scale.z)), 2);
		refresh({ mirrors: true });
		configureGizmo();
	} else if (!event.value) {
		refresh({});
	}
});

transform.addEventListener('objectChange', () => {
	if (transform.mode === 'scale') return;
	readBack(transform.object);
	refresh({ light: true });
});

const pointer = { x: 0, y: 0 };
const raycaster = new THREE.Raycaster();

renderer.domElement.addEventListener('pointerdown', (event) => {
	pointer.x = event.clientX;
	pointer.y = event.clientY;
	effectVideo.play().catch(() => {});
});

renderer.domElement.addEventListener('pointerup', (event) => {
	if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 5 || transform.dragging || transform.axis) return;
	const bounds = renderer.domElement.getBoundingClientRect();
	const ndc = new THREE.Vector2(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
	raycaster.setFromCamera(ndc, camera);
	const targets = [parts.projector, parts.camera, parts.dj, parts.truss, parts.mirrors];
	const hits = raycaster.intersectObjects(targets, true);
	// With the truss selected, a mounting point wins over the truss tubes right above it
	const mountHit = state.selection === 'truss' ? hits.find((item) => item.object.userData.isMounts) : null;
	if (mountHit) {
		toggleMount(state.mountPoints[mountHit.instanceId].id);
		return;
	}
	const hit = hits[0];
	if (!hit) return;
	let node = hit.object;
	while (node && !node.userData.select) node = node.parent;
	if (node) select(node.userData.select);
});

function toggleMount(id) {
	const mounts = new Set(state.setup.mounts || []);
	if (mounts.has(id)) mounts.delete(id);
	else mounts.add(id);
	state.setup.mounts = [...mounts];
	refresh({});
}

// Toolbar, buttons and keys

function setView(name) {
	const preset = VIEW_PRESETS[name];
	state.viewTarget = { position: new THREE.Vector3(...preset.position), target: new THREE.Vector3(...preset.target) };
	document.querySelectorAll('[data-view]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.view === name)));
}

function setMode(mode) {
	state.mode = mode;
	configureGizmo();
}

document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
document.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
document.querySelectorAll('[data-toggle]').forEach((button) => button.addEventListener('click', () => {
	const key = button.dataset.toggle;
	state.toggles[key] = !state.toggles[key];
	button.setAttribute('aria-pressed', String(state.toggles[key]));
	applyToggles();
	configureGizmo();
}));

function applyToggles() {
	parts.crowd.visible = state.toggles.crowd;
	const [beam, cameraView] = parts.optics.children;
	if (beam) beam.visible = state.toggles.beam;
	if (cameraView) cameraView.visible = state.toggles.cameraView;
	scene.traverse((node) => {
		if (node.userData.isNameTag) node.visible = state.toggles.labels;
	});
}

document.getElementById('btnAddMirror').addEventListener('click', () => {
	const ids = state.setup.mirrors.map((mirror) => Number(mirror.id.slice(1)) || 0);
	const id = `m${Math.max(0, ...ids) + 1}`;
	// New mirrors appear beside the truss so they are easy to see and grab
	const { truss } = state.setup;
	const mirror = { id, x: round(truss.x + truss.w / 2 + 1.5, 2), y: 3.5, z: round(truss.z, 2), w: 2, d: 1.5, tilt: 0, yaw: 0, roll: 0, panel: 1 };
	state.setup.mirrors.push(mirror);
	autoMounts({ mirrors: [mirror], keep: true });
	refresh({ mirrors: true });
	select(`mirror:${id}`);
});

function deleteSelectedMirror() {
	const mirror = selectedMirror();
	if (!mirror || state.setup.mirrors.length < 2) return;
	state.setup.mirrors = state.setup.mirrors.filter((item) => item !== mirror);
	transform.detach();
	refresh({ mirrors: true });
	select('projector');
}

document.getElementById('btnDelete').addEventListener('click', deleteSelectedMirror);

document.getElementById('btnReset').addEventListener('click', () => {
	if (!window.confirm('Alle wijzigingen terugzetten naar de previz-opstelling?')) return;
	state.setup = defaultSetup();
	refresh({ venue: true, truss: true, mirrors: true, dj: true });
	select('projector');
	showToast('Teruggezet naar de previz');
});

document.getElementById('btnExport').addEventListener('click', () => {
	downloadJson(exportData());
	showToast('Setup geëxporteerd als JSON');
});

document.getElementById('btnCopyTd').addEventListener('click', async () => {
	const copied = await copyText(tdScript(exportData()));
	showToast(copied ? 'TD-script gekopieerd: plak het in de Textport' : 'Kopiëren lukte niet');
});

const importInput = document.getElementById('importFile');
document.getElementById('btnImport').addEventListener('click', () => importInput.click());
importInput.addEventListener('change', async () => {
	const file = importInput.files[0];
	if (!file) return;
	try {
		const data = JSON.parse(await file.text());
		state.setup = mergeSetup({ base: defaultSetup(), incoming: data.setup || data });
		refresh({ venue: true, truss: true, mirrors: true, dj: true });
		select('projector');
		showToast(`Setup geladen uit ${file.name}`);
	} catch (error) {
		showToast('Dit bestand is geen geldige setup');
	}
	importInput.value = '';
});

window.addEventListener('keydown', (event) => {
	if (event.target.closest('input, textarea')) return;
	const keys = { w: 'translate', e: 'rotate', r: 'scale' };
	if (keys[event.key]) setMode(keys[event.key]);
	if ((event.key === 'Delete' || event.key === 'Backspace') && selectedMirror()) deleteSelectedMirror();
});

// Updating everything after a change

function refresh(scope) {
	// Scope object: which parts need rebuilding ({ venue, truss, mirrors, dj }); optics always update
	if (scope.venue) buildVenue();
	if (scope.truss) buildTruss();
	if (scope.mirrors) buildMirrors();
	if (scope.dj) buildDj();
	colourMounts();
	syncTransforms();
	updateCables();
	updateOptics();
	updateMeasurements();
	updateDimension();
	updatePropInputs();
	if (!scope.light) renderObjectList();
	if (scope.mirrors || scope.truss || scope.dj) {
		configureGizmo();
		updateSelectionBox();
	}
	applyToggles();
	saveSoon();
}

// Render loop

function resize() {
	const { clientWidth: width, clientHeight: height } = viewportEl;
	if (!width || !height) return;
	renderer.setSize(width, height);
	labelRenderer.setSize(width, height);
	camera.aspect = width / height;
	camera.updateProjectionMatrix();
	const size = new THREE.Vector2();
	renderer.getDrawingBufferSize(size);
	mirrorObjects.forEach((group) => group.children[0].getRenderTarget().setSize(Math.round(size.x * 0.6), Math.round(size.y * 0.6)));
}

new ResizeObserver(resize).observe(viewportEl);

function animate() {
	if (state.viewTarget) {
		camera.position.lerp(state.viewTarget.position, 0.12);
		orbit.target.lerp(state.viewTarget.target, 0.12);
		if (camera.position.distanceTo(state.viewTarget.position) < 0.02) state.viewTarget = null;
	}
	orbit.update();
	if (selectionBox) selectionBox.update();
	renderer.render(scene, camera);
	labelRenderer.render(scene, camera);
}

buildDevice({ group: parts.projector, size: [0.5, 0.22, 0.42], colour: 0xcdb8ff, name: 'Projector' });
buildDevice({ group: parts.camera, size: [0.16, 0.12, 0.24], colour: 0xe8e8ee, name: 'Camera', tagBelow: true });
refresh({ venue: true, truss: true, mirrors: true, dj: true });
select('projector');
resize();
renderer.setAnimationLoop(animate);

// Handle for checking the configurator from the browser console
window.bbConfigurator = { state, camera, parts, transform, exportData, tdScript };
