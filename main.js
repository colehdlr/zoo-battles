import Player from "./player.js";
import keyboard from "./kbHandler.js";

let fetched = false;

// Maps.json
fetch('https://raw.githubusercontent.com/colehdlr/zoo-battles/main/maps.json')
  .then(response => response.json())
  .then(data => {
    maps = data.maps;
    fetched = true;
  })
  .catch(error => console.error('Error fetching the JSON file:', error));

// APP
const app = new PIXI.Application();
await app.init({transparent:true, antialias: true, resizeTo: window});
app.resizeTo = ""; // Don't resize again

// MAP
const world = new PIXI.Container();
const map = new PIXI.Container();
const all = new PIXI.Container();

/* CONTAINER TREE
                 stage
                  all
         world            
     map     enemies   player
*/

const smallRectCtx = new PIXI.GraphicsContext()
        .rect(0, 0, 200, 100)
        .fill('yellow');
const largeRectCtx = new PIXI.GraphicsContext()
        .rect(0, 0, 500, 100)
        .fill('orange');
const playerCtx = new PIXI.GraphicsContext()
        .rect(0, 0, 50, 100)
        .fill('green');
const enemyCtx = new PIXI.GraphicsContext()
        .rect(0, 0, 50, 100)
        .fill('red');

// SPRITES
let playerName;
let player;
let maps;
const players = [];

// INPUTS
const left = keyboard("ArrowLeft");
const right = keyboard("ArrowRight");
const up = keyboard("ArrowUp");
//const down = keyboard("ArrowDown");

// CREATE PEER
const peer = new Peer();
peer.on("open", () => {
    console.log(`Your device ID is: ${peer.id}`);
});
peer.on('disconnected', () => {
    console.warn("Connection lost. Attempting to reconnect...");
    peer.reconnect();
});

document.getElementById('hostButton').addEventListener('click', function() {
    if (fetched) {
        const name = document.getElementById('name').value.trim();
        const mapNum = document.getElementById('maps').value;
        if (name !== "") {
            document.getElementById('mainMenu').style.display = 'none';
            document.getElementById('gui').style.display = 'block';
            document.getElementById('gameId').innerHTML = peer.id;
            playerName = name;
            hostGame(mapNum);
        }
        else {
            alert("Please enter a valid name.");
        }
    }
});

document.getElementById('joinButton').addEventListener('click', function() {
    if (fetched) {
        const name = document.getElementById('name').value.trim();
        if (name !== "") {
            const peerId = document.getElementById('peerId').value.trim();
            if (peerId !== "") {
                document.getElementById('joinButton').disabled = "disabled";
                playerName = name;
                connectPeer(peerId);
            }
            else {
                alert("Please enter a lobby ID.");
            }
        }
        else {
            alert("Please enter a valid name.");
        }
    }
});

function connectPeer(peerId) {
    // CONNECT TO HOST
    const conn = peer.connect(peerId);
    var verifiedConnection = false;

    // GREET SERVER
    conn.on('open', function(){
        conn.send(["ZOOBATTLE", {id: peer.id, name: playerName}]);
    });
    // CAN'T CONNECT
    conn.on('error', (error) => {
        console.error('Connection error:', error);
        alert("Connection to lobby failed.");
        return;
    });
    // RECIEVE DATA
    conn.on('data', function(data){
        switch (data[0]) {
            case "ZOOBATTLE":
                // Server has recieved the request
                verifiedConnection = true;
                document.getElementById('gameId').innerHTML = conn.id;
                joinGame(conn, data[1].mapNum, data[1].playersInfo);
                break;
            case "UPDATE":
                const playersInfo = data[1];
                for (let i = 0; i < playersInfo.length; i++) {
                    players[i].sprite.position.x = playersInfo[i].x;
                    players[i].sprite.position.y = playersInfo[i].y;
                }
                break;
            default:
                console.error("Data is not tagged or tag is not understood.")
                break;
        }
    });

    setTimeout(() => {
        if (!verifiedConnection) {
            conn.close();
            document.getElementById('joinButton').disabled = "";
            alert("Connection to lobby failed.");
        }
        else {
            console.log("Connection verified.")
        }
    }, 2000);
}
function joinGame(conn, mapNum, playersInfo) {
    // INIT GAME
    document.getElementById('mainMenu').style.display = 'none';
    document.getElementById('gui').style.display = 'block';

    // APP INIT
    document.body.appendChild(app.canvas);

    // CREATE MAP
    createMap(mapNum); // Adds world to all

    // ADD PLAYER
    const playerSprite = new PIXI.Graphics(playerCtx);
    player = new Player(playerSprite, peer.id, playerName);
    world.addChild(player.sprite);

    playersInfo.forEach(enemyInfo => {
        const enemySprite = new PIXI.Graphics(enemyCtx);
        const enemy = new Player(enemySprite, enemyInfo.id, enemyInfo.name);
        players.push(enemy);
        world.addChild(enemy.sprite);
    });

    players.push(player); // This is done here to match the order of the host

    // ADD MAP
    app.stage.addChild(all);

    // GAME LOOP
    app.ticker.maxFPS = 144;
    app.ticker.add((delta) => {
        const updateInfo = checkInputsClient(delta.deltaTime);
        conn.send(["UPDATE", updateInfo]);

        // MOVE CAMERA
        if (player.position.x !== NaN) {
            const moveX = player.sprite.getGlobalPosition().x - app.width/2;
            const moveY = player.sprite.getGlobalPosition().y - app.height/2;
            all.position.x -= moveX*delta.deltaTime*0.2;
            all.position.y -= moveY*delta.deltaTime*0.2;
        }
    });
}

function hostGame(mapNum) {
    // CREATE SERVER
    peer.options.port = 8080 // REMOVE AFTER TESTING --------------------- ALERT ------------------ ALERT ---------------- ALERT ------------------------- ALERT ---------

    // ALLOW CONNECTION
    peer.on('connection', function(conn) {
        console.log("Connected to new client.");
        conn.on('data', function(data){
            //console.log(data);
            switch (data[0]) {
                case "ZOOBATTLE":
                    // A client has joined and wants some data
                    // Collect players info
                    const playersInfo = [];
                    players.forEach(player => {
                        const id = player.id;
                        const name = player.name;
                        playersInfo.push({id: id, name: name});
                    });
                    conn.send(["ZOOBATTLE", {mapNum: mapNum, playersInfo: playersInfo}]);

                    // Use data
                    const enemySprite = new PIXI.Graphics(enemyCtx);
                    const enemy = new Player(enemySprite, data[1].id, data[1].name);
                    world.addChild(enemy.sprite);
                    enemy.sprite.position = map.position;
                    players.push(enemy);
                    break;
                case "UPDATE":
                    const id = data[1].id;
                    const delta = data[1].delta;
                    const horizontal = data[1].horizontal;
                    const jump = data[1].jump;
                    let i;

                    for (i = 0; i < players.length; i++) {
                        if (players[i].id == id) {
                            break;
                        }
                    }

                    if (horizontal > 0) {
                        players[i].velocity.x += 0.8;
                    }
                    else if (horizontal < 0) {
                        players[i].velocity.x += -0.8;
                    }
                    else {
                        // SLOW TO A STOP
                        if (players[i].grounded) {
                            players[i].velocity.x /= (1 + delta*0.4);
                        }
                        else {
                            players[i].velocity.x /= (1 + delta*0.05);
                        }
                    }
                    if (jump) {
                        if (players[i].jumps > 0) {
                            players[i].velocity.y = 3;
                            players[i].jumps -= 1;
                        }
                    }

                    players[i].update(delta, map.children, map.position);

                    const playerPositions = [];
                    for (let i = 0; i < players.length; i++) {
                        const posX = players[i].sprite.position.x;
                        const posY = players[i].sprite.position.y;
                        playerPositions.push({x: posX, y: posY});
                    }
                    conn.send(["UPDATE", playerPositions]);
                    break;
                default:
                    console.error("Data is not tagged or tag is not understood.")
                    break;
            }
            
        });
    });
    
    // APP INIT
    document.body.appendChild(app.canvas);

    // CREATE MAP
    createMap(mapNum);

    // ADD PLAYER
    const playerSprite = new PIXI.Graphics(playerCtx);
    player = new Player(playerSprite, peer.id, playerName);
    players.push(player);
    world.addChild(player.sprite);
    player.sprite.position = map.position;

    // ADD MAP
    app.stage.addChild(all);

    // GAME LOOP
    app.ticker.maxFPS = 144;
    app.ticker.add((delta) => {
        gameLoop(delta.deltaTime);
    });
}

function createMap(mapNum) {
    maps[mapNum].largeRects.forEach(largeRect => { 
        const newRect = new PIXI.Graphics(largeRectCtx);
        const x = largeRect.x + map.position.x;
        const y = largeRect.y + map.position.y;

        newRect.position = {x, y};
        map.addChild(newRect);
    });
    maps[mapNum].smallRects.forEach(smallRect => {
        const newRect = new PIXI.Graphics(smallRectCtx);
        const x = smallRect.x + map.position.x;
        const y = smallRect.y + map.position.y;

        newRect.position = {x, y};
        map.addChild(newRect);
    });
    world.addChild(map);
    all.addChild(world);
}

function gameLoop(delta) {
    checkInputs(delta);

    // UPDATE
    player.update(delta, map.children, map.position);

    // MOVE CAMERA
    const moveX = player.sprite.getGlobalPosition().x - app.width/2;
    const moveY = player.sprite.getGlobalPosition().y - app.height/2;
    all.position.x -= moveX*delta*0.2;
    all.position.y -= moveY*delta*0.2;
}

function checkInputs(delta) {
    if (left.isDown) {
        player.velocity.x += -0.8;
    }
    else if (right.isDown) {
        player.velocity.x += 0.8;
    }
    else {
        // SLOW TO A STOP
        if (player.grounded) {
            player.velocity.x /= (1 + delta*0.4);
        }
        else {
            player.velocity.x /= (1 + delta*0.05);
        }
    }
    up.press = () => {
        if (player.jumps > 0) {
            player.velocity.y = 3;
            player.jumps -= 1;
        }
    }
}

function checkInputsClient(delta) {
    let horizontal = 0;
    let jump = false;
    if (left.isDown) {
        horizontal = -1;
    }
    else if (right.isDown) {
        horizontal = 1;
    }
    if (up.isDown) {
        jump = true;
        up.isDown = false;
    }

    return({id: peer.id, delta: delta, horizontal: horizontal, jump: jump});
}
