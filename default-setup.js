// Default setup of the configurator: the "setup" part of a file saved with Export JSON
// To change the default, export a new setup and replace this object
const DEFAULT_SETUP = {
	"venue": {
		"floorW": 14,
		"floorD": 15,
		"wallH": 6,
		"crowdW": 11,
		"crowdD": 13.5,
		"crowdCount": 45,
		"headHeight": 1.7
	},
	"truss": {
		"x": 0,
		"z": 0,
		"w": 10.78,
		"d": 8.52,
		"height": 5.98,
		"size": 0.29,
		"crossbeams": 2,
		"towers": true
	},
	"projector": {
		"x": 0,
		"y": 5.75,
		"z": 0.05,
		"yaw": 0,
		"pitch": -90,
		"roll": 0,
		"hFov": 107,
		"lumens": 10000
	},
	"camera": {
		"enabled": true,
		"x": -0.05,
		"y": 6.15,
		"z": 4.15,
		"yaw": 0,
		"pitch": -20,
		"roll": 0,
		"hFov": 60
	},
	"dj": {
		"x": 0,
		"z": -0.25,
		"yaw": 0,
		"riser": 0.4
	},
	"motors": {
		"enabled": true,
		"low": 3,
		"high": 5,
		"speed": 0.4,
		"pattern": "alternate",
		"beats": 32,
		"bpm": 128
	},
	"mirrors": [
		{
			"mount": "truss",
			"x": -1.8,
			"y": 3.5,
			"z": 0,
			"w": 1,
			"d": 3,
			"yaw": 0,
			"elevation": -90,
			"spin": 0,
			"panel": 1,
			"id": "m1"
		},
		{
			"mount": "truss",
			"x": 1.8,
			"y": 3.5,
			"z": 0,
			"w": 1,
			"d": 3,
			"yaw": 0,
			"elevation": -90,
			"spin": 0,
			"panel": 1,
			"id": "m2"
		}
	],
	"mounts": [
		"right:6",
		"right:9",
		"cross2:7",
		"cross2:9",
		"cross1:9",
		"cross1:7"
	]
};
