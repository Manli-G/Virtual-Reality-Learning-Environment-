///////////////////////////////////////////////////
////////////////////////EXPRESS////////////////////
//////////////////////////////////////////////////
const express = require('express');
const app = express();
const url = require('url');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const session = require('express-session');
const bodyparser = require('body-parser');
const cookieParser = require('cookie-parser');
const MemoryStore = require('memorystore')(session);
const methodOverride = require('method-override');
const nodeStatic = require('node-static');
const fileServer = new(nodeStatic.Server)();
///////////////for a SSL connection////////////
const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};
/////////////////////////////////////////////////////
///////////////////////HTTP/////////////////////////
///////////////////////////////////////////////////

const HTTPS_PORT = 8443; //default port for https is 443
const HTTP_PORT = 8003; //default port for http is 80

const https = require('https').createServer(options,app,function(req,res){
  fileServer.serve(req, res)
}).listen(HTTPS_PORT,'0.0.0.0', function(){
    console.log('https://localhost:8443');
});

const http= require('http').createServer(app,function (req, res) {
    fileServer.serve(req, res)
}).listen(HTTP_PORT,'0.0.0.0', function(){
    console.log('localhost:8003');
});

/////////////////////////////////////////////////////
/////////////////////////Middleware/////////////////
////////////////////////////////////////////////////

var storeMemory = new MemoryStore({
        reapInterval: 60000 * 10
    });
app.use(bodyparser.json());
app.use(bodyparser.urlencoded({ extended: true }));
app.use(methodOverride());
app.use(cookieParser());
const sessionMiddleware = session({
  secret: "my-secret",
  resave: true,
  saveUninitialized: true,
  store:storeMemory,
  cookie : {
    httpOnly: true,
    //maxAge : 1000 * 60 * 3 // setting the session duration time
    }
})
app.use(sessionMiddleware);

/////////////Socket Middleware//////////////////
const io = require('socket.io')(http);
io.use(function(socket, next) {
    sessionMiddleware(socket.request, socket.request.res || {}, next);
});

////////////Setup the views folder//////////////

app.set('views', __dirname + '/views');//Set the template file location
app.set('view engine', 'html');//Set the parsing template file type: here is an html file
app.use(express.static(path.join(__dirname, 'public')));// Set the static path file

/////////////////////////////////////////////////
/////////////////////ROUTER/////////////////////
///////////////////////////////////////////////

app.post('/login', function(req, res){
    if(req.body.username&&req.body.username !== ''&&req.body.role&&req.body.role !== ''&&req.body.room&&req.body.room !== ''){
        req.session.username = req.body.username;
        req.session.role = req.body.role;
        req.session.room = req.body.room;
        //console.log('Usersname:',req.session.username);
        //console.log('Role:',req.session.role);
        //console.log('Room:',req.session.room);
        //console.log(req.cookies);
        res.redirect('/');
    }
    else{
        res.json({ret_code : 1, ret_msg : ' cannot be empty'});
    }
});// login page
app.get('/', function (req, res) {
    if(req.session.username){  //Check the session status, if valid, return to the main page, otherwise go to the login page
        res.sendFile('main.html', { root: path.join(__dirname, 'views') });
    }else{
        res.sendFile('login.html', { root: path.join(__dirname, 'views') });
    }
});// index page


//////////////////////////////////////////////////////
/////////////////////Setup Socket/////////////////////
/////////////////////////////////////////////////////

const users = {};
//const ns = io.of('/main');
io.sockets.on('connection', function(socket,req,res){



  //const session = socket.handshake.session;//session
  //console.log('socket session:',socket.handshake.session);
  const session = socket.request.session;
  const username = session.username;

  const role = session.role;
  const room = session.room;
  users[username]= socket.id;
	socket.userData = { x:0, y:0, z:0, heading:0 };//Default values;
  socket.name = username;
  socket.role = role;
  //console.log(`${socket.id} connected`);
	console.log(`Connection: ${username}(${role}) Enter Room （${room}）`);
  //console.log(`${users[username]} connected`);

  //////////////////////////Room////////////////////////
  /*
  socket.on('join', function(room) {
    socket.join(room);
    var clientsInRoom = io.nsps['/'].adapter.rooms[room];
    //var clientsInRoom = io.sockets.adapter.rooms[room];
    var numClients = clientsInRoom === undefined ? 0 : Object.keys(clientsInRoom.sockets).length;

    if (numClients === 0) {
      socket.join(room);
      log(`${role}：${username} join the room` + room);
      //log('Client ID ' + socket.id + ' join room ' + room);
      //socket.emit('created', room, socket.id);

    } else if (numClients === 1) {
      log(`new ${role}：${username} join the room`+ room);
      //log('Client ID ' + username + ' joined room ' + room);
      io.sockets.in(room).emit('new join', room);
      //socket.emit('joined', room, socket.id);
      io.sockets.in(room).emit('ready');
    }
    log('Class Room ' + room + ' Now has ' + (numClients +1) + ' Student/Teacher(s)');
  });
*/
function log() {
  var array = ['>>>>Server>>>>'];
  array.push.apply(array, arguments);
  socket.emit('server log', array);
}

io.sockets.emit('room',room);
/*
socket.on('about the room', function(room) {
  console.log('>>Server>> Someone going to join the' + room);

  var clientsInRoom = io.sockets.adapter.rooms[room];
  var numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;
  log('>>Server>> Room ' + room + ' now has ' + numClients + ' student(s)');

  if (numClients === 0) {
    socket.join(room);
    //log('Client ID ' + socket.id + ' created room ' + room);
    log(`>>Server>>${role}：${username} is the first ${role} join the room (${room}）`);
    //io.sockets.emit('first joiner', room);

  } else if (numClients === 1) {
    //log('Client ID ' + socket.id + ' joined room ' + room);
    log(`${role}：${username} joined the room (${room}）`);
    //io.sockets.in(room).emit('join', room);
    socket.join(room);
    //socket.emit('joined',room);
    //io.sockets.in(room).emit('ready');
  }


});
*/
////////////////////////Client Data Handle/////////////////
socket.emit('role',socket.role);
socket.emit('setId', { id:socket.id });
socket.emit('nameLabel',socket.name);
socket.emit('remoteData',{ data:socket.data })

//io.sockets.emit('role',role);
//Handle the disconnection
socket.on('disconnect', function(data){
console.log(`Disconnected:${username}(${role})leave the room ${room}`)
socket.emit('deletePlayer', { id: socket.id });
});

//Iniitializated model data
socket.on('init', function(data){
  console.log(`socket.init ${data.model}:${username}`);

  socket.userData.model = data.model;
  socket.userData.username = data.name;
  socket.userData.colour = data.colour;
  socket.userData.x = data.x;
  socket.userData.y = data.y;
  socket.userData.z = data.z;
  socket.userData.heading = data.h;
  socket.userData.pb = data.pb,
  socket.userData.action = "Idle";
});

// Update model data
socket.on('update', function(data){
  socket.userData.x = data.x;
  socket.userData.y = data.y;
  socket.userData.z = data.z;
  socket.userData.heading = data.h;
  socket.userData.pb = data.pb,
  socket.userData.action = data.action;
});

// Setup chat message
socket.on('chat message', function(data){
  console.log(`chat message:${data.id} ${data.message}`);
  socket.emit('chat message', { id: socket.id, message: data.message });

});


  // WebRTC Signaling
  socket.on('message', function(message) {
    log('Client Said: ', message);
    // for a real app, would be room-only (not broadcast)
    socket.broadcast.emit('message', message);
  });




});


setInterval(function(){
	const nsp = io.of('/');
    let pack = [];

    for(let id in io.sockets.sockets){
        const socket = nsp.connected[id];
		//Only push sockets that have been initialised
		if (socket.userData.model!==undefined){
			pack.push({
				id: socket.id,
				model: socket.userData.model,
				colour: socket.userData.colour,
				x: socket.userData.x,
				y: socket.userData.y,
				z: socket.userData.z,
				heading: socket.userData.heading,
				pb: socket.userData.pb,
				action: socket.userData.action
			});
		}
    }
	if (pack.length>0) io.emit('remoteData', pack);
},40);
