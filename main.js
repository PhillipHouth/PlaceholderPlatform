var canvas = document.getElementById("gameCanvas");
var context = canvas.getContext("2d");

var startFrameMillis = Date.now();
var endFrameMillis = Date.now();

// This function will return the time in seconds since the function 
// was last called
// You should only call this function once per frame
function getDeltaTime() {
    endFrameMillis = startFrameMillis;
    startFrameMillis = Date.now();

    // Find the delta time (dt) - the change in time since the last drawFrame
    // We need to modify the delta time to something we can use.
    // We want 1 to represent 1 second, so if the delta is in milliseconds
    // we divide it by 1000 (or multiply by 0.001). This will make our 
    // animations appear at the right speed, though we may need to use
    // some large values to get objects movement and rotation correct
    var deltaTime = (startFrameMillis - endFrameMillis) * 0.001;

    // validate that the delta is within range
    if (deltaTime > 1)
        deltaTime = 1;

    return deltaTime;
}

//-------------------- Don't modify anything above here

var SCREEN_WIDTH = canvas.width;
var SCREEN_HEIGHT = canvas.height;


// some variables to calculate the Frames Per Second (FPS - this tells use
// how fast our game is running, and allows us to make the game run at a 
// constant speed)
var fps = 0;
var fpsCount = 0;
var fpsTime = 0;

// load an image to draw

var STATE_SPLASH = 0;
var STATE_GAME = 1;
var STATE_GAMEOVER = 2;
var STATE_WIN = 3;

var gameState = STATE_SPLASH;

var score = 10000;
var lives = 3;
var heartImage = document.createElement("img");
heartImage.src = "heartImage.png";

var MAP = { tw: 100, th: 15 };
var TILE = 35;
var TILESET_TILE = TILE * 2;
var TILESET_PADDING = 2;
var TILESET_SPACING = 2;
var TILESET_COUNT_X = 14;
var TILESET_COUNT_Y = 14;
var LAYER_COUNT = 3;
var LAYER_BACKGOUND = 0;
var LAYER_PLATFORMS = 1;
var LAYER_FOREGROUND = 2;



var player = new Player();
var keyboard = new Keyboard();

// abitrary choice for 1m
var METER = TILE;
// very exaggerated gravity (6x)
var GRAVITY = METER * 9.8 * 6;
// max horizontal speed (10 tiles per second)
var MAXDX = METER * 10;
// max vertical speed (15 tiles per second)
var MAXDY = METER * 15;
// horizontal acceleration - take 1/2 second to reach maxdx
var ACCEL = MAXDX * 2;
// horizontal friction - take 1/6 second to stop from maxdx
var FRICTION = MAXDX * 6;
// (a large) instantaneous jump impulse
var JUMP = METER * 1500;

var tileset = document.createElement("img");
tileset.src = "tileset.png";

var cells = []; // the array that holds our simplified collision data

var musicBackground;
var sfxFire;



function initialize() {
    for (var layerIdx = 0; layerIdx < LAYER_COUNT; layerIdx++) { // initialize the collision map
        cells[layerIdx] = [];
        var idx = 0;
        for (var y = 0; y < level1.layers[layerIdx].height; y++) {
            cells[layerIdx][y] = [];
            for (var x = 0; x < level1.layers[layerIdx].width; x++) {
                if (level1.layers[layerIdx].data[idx] != 0) {
                    // for each tile we find in the layer data, we need to create 4 collisions
                    // (because our collision squares are 35x35 but the tile in the
                    // level are 70x70)
                    cells[layerIdx][y][x] = 1;
                    cells[layerIdx][y - 1][x] = 1;
                    cells[layerIdx][y - 1][x + 1] = 1;
                    cells[layerIdx][y][x + 1] = 1;
                }
                else if (cells[layerIdx][y][x] != 1) {
                    // if we haven't set this cell's value, then set it to 0 now
                    cells[layerIdx][y][x] = 0;
                }
                idx++;
            }
        }
    }
    musicBackground = new Howl(
        {
            urls: ["background.mp3"],
            loop: true,
            buffer: true,
            volume: 0.3
        });
    musicBackground.play();

    sfxJump = new Howl(
        {
            urls: ["jump.wav"],
            buffer: true,
            volume: 0.2,
            onend: function () {
                isSfxPlaying = false;
            }
        });
    sfxDeathFall = new Howl(
        {
            urls: ["death.wav"],
            buffer: true,
            volume: 0.2,
            onend: function () {
                isSfxPlaying = false;
            }
        });
    sfxGameOverFall = new Howl(
        {
            urls: ["lastlife.wav"],
            buffer: true,
            volume: 0.2,
            onend: function () {
                isSfxPlaying = false;
            }
        });
    sfxWin = new Howl(
        {
            urls: ["win.wav"],
            buffer: true,
            volume: 0.2,
            onend: function () {
                isSfxPlaying = false;
            }
        });
    sfxLoseLife = new Howl(
        {
            urls: ["loselife.wav"],
            buffer: true,
            volume: 0.2,
            onend: function () {
                isSfxPlaying = false;
            }
        });
    sfxTimeOut = new Howl(
        {
            urls: ["timeout.wav"],
            buffer: true,
            volume: 0.2,
            onend: function () {
                isSfxPlaying = false;
            }
        });
}

function cellAtPixelCoord(layer, x, y) {
    if (x < 0 || x > SCREEN_WIDTH || y < 0) // remove ‘|| y<0’
        return 1;
    // let the player drop of the bottom of the screen
    // (this means death)
    if (y > SCREEN_HEIGHT)
        return 0;
    return cellAtTileCoord(layer, p2t(x), p2t(y));
};
function cellAtTileCoord(layer, tx, ty) // remove ‘|| y<0’
{
    if (tx < 0 || tx >= MAP.tw || ty < 0)
        return 1;
    // let the player drop of the bottom of the screen
    // (this means death)
    if (ty >= MAP.th)
        return 0;
    return cells[layer][ty][tx];
};
function tileToPixel(tile) {
    return tile * TILE;
};
function pixelToTile(pixel) {
    return Math.floor(pixel / TILE);
};
function bound(value, min, max) {
    if (value < min)
        return min;
    if (value > max)
        return max;
    return value;
}


var worldOffsetX = 0;
function drawMap() {
    var startX = -1;
    var maxTiles = Math.floor(SCREEN_WIDTH / TILE) + 2;
    var tileX = pixelToTile(player.position.x);
    var offsetX = TILE + Math.floor(player.position.x % TILE);

    startX = tileX - Math.floor(maxTiles / 2);

    if (startX < -1) {
        startX = 0;
        offsetX = 0;
    }
    if (startX > MAP.tw - maxTiles) {
        startX = MAP.tw - maxTiles + 1;
        offsetX = TILE;
    }

    worldOffsetX = startX * TILE + offsetX;

    for (var layerIdx = 0; layerIdx < LAYER_COUNT; layerIdx++) {
        for (var y = 0; y < level1.layers[layerIdx].height; y++) {
            var idx = y * level1.layers[layerIdx].width + startX;
            for (var x = startX; x < startX + maxTiles; x++) {
                if (level1.layers[layerIdx].data[idx] != 0) {
                    // the tiles in the Tiled map are base 1 (meaning a value of 0 means no tile),
                    // so subtract one from the tileset id to get the correct tile
                    var tileIndex = level1.layers[layerIdx].data[idx] - 1;
                    var sx = TILESET_PADDING + (tileIndex % TILESET_COUNT_X) *
                        (TILESET_TILE + TILESET_SPACING);
                    var sy = TILESET_PADDING + (Math.floor(tileIndex / TILESET_COUNT_Y)) *
                        (TILESET_TILE + TILESET_SPACING);
                    context.drawImage(tileset, sx, sy, TILESET_TILE, TILESET_TILE,
                        (x - startX) * TILE - offsetX, (y - 1) * TILE, TILESET_TILE, TILESET_TILE);
                }
                idx++;
            }
        }
    }
}


function run() {
    context.fillStyle = "#ccc";
    context.fillRect(0, 0, canvas.width, canvas.height);

    var deltaTime = getDeltaTime();

    switch (gameState) {
        case STATE_SPLASH: runSplash(deltaTime);
            break;
        case STATE_GAME: runGame(deltaTime);
            break;
        case STATE_GAMEOVER: runGameOver(deltaTime);
            break;
        case STATE_WIN: runWin(deltaTime);
            break;
    }
}



var splashTimer = 120
function runSplash(deltaTime) {
    drawMap();
    context.fillStyle = "#000";
    context.font = "40px Arial";
    context.fillText("Project: Platform", 150, 200);

    if (gameState == STATE_SPLASH & splashTimer == 0) {
        context.fillStyle = "#000";
        context.font = "20px Arial";
        context.fillText("Press S or Down to Start", 150, 400);
        if (keyboard.isKeyDown(keyboard.KEY_S) == true || keyboard.isKeyDown(keyboard.KEY_DOWN) == true) {
            gameState = STATE_GAME;
            return;
        }
    }
    else splashTimer = splashTimer - 1
}


function runGame(deltaTime) {
    player.update(deltaTime);

    drawMap();
    player.draw();

    // life counter
    for (var i = 0; i < lives; i++) {
        context.fillStyle = "yellow";
        context.font = "32px Arial";
        var lifeCounter = "x " + (lives - 1);
        context.fillText(lifeCounter, 70, 60);
        context.drawImage(heartImage, 10, 20);
    }

    // update the frame counter
    fpsTime += deltaTime;
    fpsCount++;
    if (fpsTime >= 1) {
        fpsTime -= 1;
        fps = fpsCount;
        fpsCount = 0;
    }

    // draw the FPS
    context.fillStyle = "#f00";
    context.font = "14px Arial";
    context.fillText("FPS: " + fps, 5, 20, 100);

    score -= 10;
    if (score <= 0) {
        lives--;
        score = 5000;
    }
    // score
    context.fillStyle = "yellow";
    context.font = "32px Arial";
    var scoreText = "Score: " + score;
    context.fillText(scoreText, SCREEN_WIDTH - 200, 50);
}



function runGameOver(deltaTime) {
    drawMap();
    context.fillStyle = "#000";
    context.font = "40px Arial";
    context.fillText("GAME OVER", 150, 200);
}

function runWin(deltaTime) {
    drawMap();
    player.draw();
    context.fillStyle = "#000";
    context.font = "40px Arial";
    context.fillText("Level Complete", 150, 200);
    context.fillStyle = "yellow";
    context.font = "32px Arial";
    var scoreText = "Score: " + score;
    context.fillText(scoreText, 150, 270);
    context.fillStyle = "yellow";
    context.font = "32px Arial";
    var lifeCounter = "x " + (lives - 1) + " = " + ((lives - 1) * 10000);
    context.fillText(lifeCounter, 220, 330);
    context.drawImage(heartImage, 150, 280);
    context.fillStyle = "yellow";
    context.font = "32px Arial";
    var scoreText = "Total: " + (score + ((lives - 1) * 10000));
    context.fillText(scoreText, 150, 400);

}

initialize();

//-------------------- Don't modify anything below here


// This code will set up the framework so that the 'run' function is called 60 times per second.
// We have a some options to fall back on in case the browser doesn't support our preferred method.
(function () {
    var onEachFrame;
    if (window.requestAnimationFrame) {
        onEachFrame = function (cb) {
            var _cb = function () { cb(); window.requestAnimationFrame(_cb); }
            _cb();
        };
    } else if (window.mozRequestAnimationFrame) {
        onEachFrame = function (cb) {
            var _cb = function () { cb(); window.mozRequestAnimationFrame(_cb); }
            _cb();
        };
    } else {
        onEachFrame = function (cb) {
            setInterval(cb, 1000 / 60);
        }
    }

    window.onEachFrame = onEachFrame;
})();

window.onEachFrame(run);
