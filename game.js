'use strict';


// ===========================================================================
// Gameplay

function Game(lvlnum) {
	var player = [0,0];
	var holding = false;
	var state;


	// Load the current level
	function load() {
		// Initialize state by copying over the level data
		var lvl = window.levels[lvlnum];
		state = new Array(lvl.length);
		for (var i = 0; i < state.length; i++) {
			state[i] = new Array(lvl[i].length)
			for (var j = 0; j < state[i].length; j++) {
				state[i][j] = lvl[i][j];
				if (state[i][j] == '<' || state[i][j] == '>') {
					player[0] = i;
					player[1] = j;
				}
			}
		}
		return game;
	}


	// Swap two points in the game
	function swap(y1, x1, y2, x2) {
		var tmp = state[y1][x1];
		state[y1][x1] = state[y2][x2];
		state[y2][x2] = tmp;
		return this;
	}


	// Move the player to a given point
	function move(dy, dx) {
		var y = player[0] + dy;
		var x = player[1] + dx;

		// Safe to move if nothing is in the way
		var safe = (
			state[y][x] == ' '
			|| state[y][x] == '!'
		) && (
			!holding
			|| state[y-1][x] == ' '
			|| state[y-1][x] == '>'
			|| state[y-1][x] == '<'
		);

		// Win if moving into the '!'
		var win = state[y][x] == '!';

		// Do the move
		if (safe) {
			swap(player[0], player[1], y, x);
			if (holding) swap(player[0]-1, player[1], y-1, x);
			if (win) state[player[0]][player[1]] = ' ';
			player = [y, x];
		}

		// Load the next level upon winning
		if (win) {
			lvlnum++;
			load();
			return this;
		}

		// Apply gravity to the player
		if (safe && state[y+1][x] == ' ' || state[y+1][x] == '!') {
			return move(1, 0);
		}

		return this;
	}


	// Apply gravity to any point
	function fall(y, x) {
		if (state[y+1][x] == ' ') {
			swap(y, x, y+1, x);
			y++;
		}
		if (state[y+1][x] == ' ') {
			return fall(y, x);
		}
		return [y, x];
	}


	// Return the width of the level
	this.width = function () {
		return state[0].length;
	}


	// Return the height of the level
	this.height = function () {
		return state.length;
	}


	// Return the coordinates of the player as [y, z]
	this.getPlayer = function () {
		return [player[0], player[1]];
	}


	// Return the object at the given point as a string
	// - 'x' indicates a wall or floor
	// - '0' indicates a movable block
	// - '>' indicates a player facing right
	// - '<' indicates a player facing left
	// - '!' indicates the goal of the level
	// - ' ' indicates open space
	this.get = function (y, x) {
		return state[y][x];
	}


	// Move the player to the left
	this.left = function () {
		move(0, -1);
		state[player[0]][player[1]] = '<';
		return this;
	}


	// Move the player to the right
	this.right = function () {
		move(0, +1);
		state[player[0]][player[1]] = '>';
		return this;
	}


	// Have the player climb a block
	this.climb = function () {
		var y = player[0];
		var x = player[1];
		var dir = state[y][x];
		var dx = (dir == '<') ? -1 : +1;
		if (state[y][x+dx] != ' ' && state[y-1][x] != 'x') {
			return move(-1, +dx);
		} else {
			return this
		}
	}


	// Have the player pick up a block
	// If the player is holding a block, have them drop the block instead
	this.grab = function () {
		if (holding) return this.drop();

		var y = player[0];
		var x = player[1];
		var dir = state[y][x];
		var dx = (dir == '<') ? -1 : +1;

		if (state[y][x+dx] == '0' && state[y-1][x] == ' '
		    && state[y-1][x+dx] == ' ') {
			state[y][x+dx] = ' ';
			state[y-1][x] = '0';
			holding = true;
		}

		return this;
	}


	// Have the player drop a block
	// If the player is not holding a block, have them grab the block instead
	this.drop = function () {
		if (!holding) return this.grab();

		var y = player[0];
		var x = player[1];
		var dir = state[y][x];
		var dx = (dir == '<') ? -1 : +1;

		if (holding) {
			if (state[y-1][x+dx] == ' ' && state[y][x+dx] == ' ') {
				state[y-1][x] = ' ';
				state[y][x+dx] = '0';
				fall(y, x+dx);
				holding = false;
			} else if (state[y-1][x+dx] == ' ') {
				state[y-1][x] = ' ';
				state[y-1][x+dx] = '0';
				holding = false;
			}
		}

		return this;
	}


	// Return the sate of the game as a string
	this.toString = function () {
		var str = '';
		state.forEach(function (row) {
			row.forEach(function (point) {
				str += point;
			});
			str += '\n';
		});
		return str;
	}

	load();
	return this;
}


// ===========================================================================
// Rendering

function Renderer(game, canvas) {
	var RESOLUTION = 1024;  // width of the canvas in pixels
	var WIDTH = 16;  // width of the viewport in game units
	var HEIGHT = WIDTH >> 1;  // height of the viewport in game units
	var UNIT = RESOLUTION / WIDTH;  // length of 1 game unit in pixels

	// Aspect ratio is fixed at 2:1
	canvas.width = RESOLUTION;
	canvas.height = RESOLUTION >> 1;

	var ctx = canvas.getContext('2d', {alpha: true});
	var viewport = [0, 0];

	var rendermap = {
		'x': drawWall,
		'<': drawDude,
		'>': drawDude,
		'!': drawDoor,
		'0': drawBlock,
		' ': drawSpace
	};


	this.render = function () {
		ctx.save();
		center();
		draw();
		ctx.restore();
	}


	function center() {
		var player = game.getPlayer();
		var halfWidth = WIDTH >> 1;
		var halfHeight = WIDTH >> 2;
		scroll(-viewport[0], -viewport[1]);
		scroll(player[0] - halfHeight, player[1] - halfWidth);
	}


	function scroll(dy, dx) {
		var max = [game.height() - (WIDTH >> 1), game.width() - WIDTH];
		dy = (viewport[0] + dy > max[0]) ? max[0] - viewport[0] :
		     (viewport[0] + dy < 0) ? 0 :
		     dy
		dx = (viewport[1] + dx > max[1]) ? max[1] - viewport[1] :
		     (viewport[1] + dx < 0) ? 0 :
		     dx
		viewport = [viewport[0] + dy, viewport[1] + dx];
	}


	function draw() {
		for (var i = 0; i < HEIGHT; i++) {
			for (var j = 0; j < WIDTH; j++) {
				var y = viewport[0];
				var x = viewport[1]
				var type = game.get(y+i, x+j);
				if (rendermap[type]) {
					rendermap[type](i, j);
				}
			}
		}
	}


	function drawBlock(y, x) {
		ctx.save();
		ctx.fillStyle = 'brown';
		ctx.fillRect(x * UNIT, y * UNIT, UNIT, UNIT);
		ctx.restore();
	}


	function drawDude(y, x) {
		ctx.save();
		ctx.fillStyle = 'red';
		ctx.fillRect(x * UNIT, y * UNIT, UNIT, UNIT);
		ctx.restore();
	}


	function drawDoor(y, x) {
		ctx.save();
		ctx.fillStyle = 'green';
		ctx.fillRect(x * UNIT, y * UNIT, UNIT, UNIT);
		ctx.restore();
	}


	function drawWall(y, x) {
		ctx.save();
		ctx.fillStyle = 'black';
		ctx.fillRect(x * UNIT, y * UNIT, UNIT, UNIT);
		ctx.restore();
	}


	function drawSpace(y, x) {
		ctx.save();
		ctx.clearRect(x * UNIT, y * UNIT, UNIT, UNIT);
		ctx.restore();
	}
}


// ===========================================================================
// Input / Output Controller

function IO(game, canvas) {
	var renderer = new Renderer(game, canvas);
	var keyboard = new window.keypress.Listener();

	keyboard.simple_combo("up", function () {
		game.climb();
		renderer.render();
	});

	keyboard.simple_combo("left", function () {
		game.left();
		renderer.render();
	});

	keyboard.simple_combo("right", function () {
		game.right();
		renderer.render();
	});

	keyboard.simple_combo("down", function () {
		game.grab();
		renderer.render();
	});

	renderer.render();
}


// ===========================================================================
// Main

var game = new Game(0);
var canvas = document.querySelector('canvas');
var io = new IO(game, canvas);
