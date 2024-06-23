import Player from "./player.js";
import keyboard from "./kbHandler.js";

// Maps.json
fetch('https://raw.githubusercontent.com/colehdlr/zoo-battles/main/maps.json')
  .then(response => response.json())
  .then(data => {
    maps = data.maps;
    fetched = true;
  })
  .catch(error => console.error('Error fetching map', error));

// INIT APP
const app = new PIXI.Application();
await app.init({transparent: true, antialias: true, resizeTo: window});

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

// HITBOXES
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
const playerLabelStyle = new PIXI.TextStyle({
    align: 'center',
    fill: '#ffffff',
    fontWeight: 'bold',
    stroke: {
        color: '#000000',
        width: 4
    }
});

// SPRITES
let playerName;
let player;
let maps;
let fetched = false;
let players = [];

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
    conn.on('open', () => {
        conn.send(["ZOOBATTLE", {name: playerName}]);
    });
    // CAN'T CONNECT
    conn.on('error', (error) => {
        console.error('Connection error:', error);
        alert("Connection to lobby failed.");
        return;
    });
    // RECIEVE DATA
    conn.on('data', (data) => {
        switch (data[0]) {
            case "ZOOBATTLE":
                // Server has recieved the request
                verifiedConnection = true;
                document.getElementById('gameId').innerHTML = peerId;
                joinGame(conn, data[1].mapNum, data[1].playersInfo);
                break;
            case "UPDATE":
                const playersInfo = data[1];
                for (let i = 0; i < playersInfo.length; i++) {
                    players[i].container.position.x = playersInfo[i].x;
                    players[i].container.position.y = playersInfo[i].y;
                    players[i].velocity.x = playersInfo[i].vx;
                    players[i].velocity.y = playersInfo[i].vy;
                }
                break;
            default:
                console.error("Data is not tagged or tag is not understood.")
                break;
        }
    });

    // Ensure connection is valid
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
    const playerContainer = new PIXI.Container();
    const playerLabel = new PIXI.Text({text: playerName, style: playerLabelStyle});
    playerLabel.position.y -= 40;
    playerLabel.position.x += playerSprite.width/2 - playerLabel.width/2;
    playerContainer.addChild(playerSprite);
    playerContainer.addChild(playerLabel);
    player = new Player(playerSprite, peer.id, playerName, playerContainer);
    world.addChild(player.container);

    playersInfo.forEach(enemyInfo => {
        const enemySprite = new PIXI.Graphics(enemyCtx);
        const enemyContainer = new PIXI.Container();
        const enemyLabel = new PIXI.Text({text: enemyInfo.name, style: playerLabelStyle});
        enemyLabel.position.y -= 40;
        enemyLabel.position.x += enemySprite.width/2 - enemyLabel.width/2;
        enemyContainer.addChild(enemySprite);
        enemyContainer.addChild(enemyLabel);
        const enemy = new Player(enemySprite, enemyInfo.id, enemyInfo.name, enemyContainer);
        players.push(enemy);
        world.addChild(enemy.container);
    });

    players.push(player); // This is done here to match the order of the host

    // ADD MAP
    app.stage.addChild(all);

    // GAME LOOP
    app.ticker.maxFPS = 144;
    app.ticker.add((delta) => {
        checkInputs();
        const horizontal = player.horizontal;
        const jump = player.jump;
        conn.send(["UPDATE", {horizontal, jump}]);

        // Update velocities for each frame
        players.forEach(player => {
            player.position.x += delta.deltaTime*player.acceleration*player.velocity.x;
            player.position.y -= delta.deltaTime*player.acceleration*player.velocity.y;
        });

        // MOVE CAMERA
        if (player.position !== NaN) {
            const moveX = player.sprite.getGlobalPosition().x - app.canvas.width/2;
            const moveY = player.sprite.getGlobalPosition().y - app.canvas.height/2;
            all.position.x -= moveX*delta.deltaTime*0.2;
            all.position.y -= moveY*delta.deltaTime*0.2;
        }
    });
}

function hostGame(mapNum) {
    // CREATE SERVER
    peer.options.port = 8080 // REMOVE AFTER TESTING --------------------- ALERT ------------------ ALERT ---------------- ALERT ------------------------- ALERT ---------

    // ALLOW CONNECTION
    peer.on('connection', (conn) => {
        console.log("Connected to new client.");
        let connId = conn.peer;
        conn.on('data', (data) => {
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
                    const enemyContainer = new PIXI.Container();
                    const enemyLabel = new PIXI.Text({text: data[1].name, style: playerLabelStyle});
                    enemyLabel.position.y -= 40;
                    enemyLabel.position.x += enemySprite.width/2 - enemyLabel.width/2;
                    enemyContainer.addChild(enemySprite);
                    enemyContainer.addChild(enemyLabel);
                    const enemy = new Player(enemySprite, connId, data[1].name, enemyContainer);
                    world.addChild(enemy.container);
                    enemy.container.position = map.position;
                    players.push(enemy);
                    break;
                case "UPDATE":
                    const horizontal = data[1].horizontal;
                    const jump = data[1].jump;
                    let i = 0;

                    while (players[i+1] && players[i].id != connId) {
                        i++;
                    };

                    if (players[i].horizontal !== horizontal) {
                        players[i].horizontal = horizontal;
                    }
                    players[i].jump = jump;

                    // Return data
                    const playerData = [];
                    for (let i = 0; i < players.length; i++) {
                        const posX = players[i].container.position.x;
                        const posY = players[i].container.position.y;
                        const velX = players[i].velocity.x;
                        const velY = players[i].velocity.y;
                        playerData.push({x: posX, y: posY, vx: velX, vy: velY});
                    }
                    conn.send(["UPDATE", playerData]);
                    break;
                default:
                    console.error("Data is not tagged or tag is not understood.")
                    break;
            }
            
        });
        conn.on('close', () => {
            console.log(`Client '${connId}' disconnected from server`);
            let stop = false;
            let i = 0;
            while (!stop && i < players.length) {
                if (players[i].id == connId) {
                    players[i].container.destroy({children:true, texture:true, baseTexture:true});
                    players.splice(i, 1);
                    stop = true;
                }
                i++;
            }
        });
    });
    
    // APP INIT
    document.body.appendChild(app.canvas);

    // CREATE MAP
    createMap(mapNum);

    // ADD PLAYER
    const playerSprite = new PIXI.Graphics(playerCtx);
    const playerContainer = new PIXI.Container();
    const playerLabel = new PIXI.Text({text: playerName, style: playerLabelStyle});
    playerLabel.position.x += playerSprite.width/2 - playerLabel.width/2;
    playerLabel.position.y -= 40;
    playerContainer.addChild(playerSprite);
    playerContainer.addChild(playerLabel);
    player = new Player(playerSprite, peer.id, playerName, playerContainer);
    players.push(player);
    world.addChild(player.container);
    player.container.position = map.position;

    // ADD MAP
    app.stage.addChild(all);

    // GAME LOOP
    app.ticker.maxFPS = 144;
    app.ticker.add((delta) => {
        // HOST INPUTS
        checkInputs();

        // UPDATE
        players.forEach(player => {
            // UPDATE INPUTS
            if (player.horizontal == -1) {
                player.velocity.x += -0.8;
            }
            else if (player.horizontal == 1) {
                player.velocity.x += 0.8;
            }
            else {
                // SLOW TO A STOP
                if (player.grounded) {
                    player.velocity.x /= (1 + delta.deltaTime*0.4);
                }
                else {
                    player.velocity.x /= (1 + delta.deltaTime*0.05);
                }
            }
            if (player.jump) {
                if (player.jumps > 0) {
                    player.velocity.y = 3;
                    player.jumps -= 1;
                }
            }

            // UPDATE POSITION
            player.update(delta.deltaTime, map.children, map.position);
        });

        // MOVE CAMERA
        if (player.sprite) {
            const moveX = player.sprite.getGlobalPosition().x - app.canvas.width/2;
            const moveY = player.sprite.getGlobalPosition().y - app.canvas.height/2;
            all.position.x -= moveX*delta.deltaTime*0.2;
            all.position.y -= moveY*delta.deltaTime*0.2;
        }
        else {
            console.warn("Player is not loaded. Cannot reposition camera.");
        }
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

function checkInputs() {
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
    player.horizontal = horizontal;
    player.jump = jump;
}
