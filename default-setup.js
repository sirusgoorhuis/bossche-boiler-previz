// Default setup of the configurator: the "setup" part of a file saved with Export JSON
// To change the default, export a new setup and replace this object
const DEFAULT_SETUP = {
	"venue": {
		"floorW": 14,
		"floorD": 12,
		"wallH": 6,
		"crowdW": 9,
		"crowdD": 7,
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
		"crossbeams": 0,
		"towers": true
	},
	"projector": {
		"x": 0,
		"y": 5.75,
		"z": 4.3,
		"yaw": 0,
		"pitch": -20,
		"roll": 0,
		"hFov": 50,
		"lumens": 10000
	},
	"camera": {
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
		"z": -5.1,
		"yaw": 0,
		"riser": 0.4
	},
	"mirrors": [
		{
			"mount": "floor",
			"x": 3.4,
			"y": 2.5,
			"z": -4.2,
			"w": 3,
			"d": 1,
			"tilt": 0,
			"yaw": 90,
			"roll": 90,
			"panel": 1,
			"id": "m1"
		},
		{
			"mount": "floor",
			"x": -3.45,
			"y": 2.5,
			"z": -4.15,
			"w": 3,
			"d": 1,
			"tilt": 0,
			"yaw": 90,
			"roll": 90,
			"panel": 1,
			"id": "m2"
		}
	],
	"mounts": []
};
