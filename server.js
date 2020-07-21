
//////EXPRESS////////
const express = require('express');
const app = express();

const path = require('path');

////////HTTP/////////
const http = require('http').createServer(app);

/////SOCKET.IO///////
const io = require('socket.io')(http);

//Port and server setup
const port = process.env.PORT || 3000;


//Setup the public client folder
app.use(express.static(path.join(__dirname, 'public')));

// Configure base route url
app.get('/', function(req, res){
    res.sendFile(__dirname + '/views/index.html');
});

http.listen(3000, '0.0.0.0', function(){
    console.log('Listening on *:3000');

});

// Setup sockets
io.sockets.on('connection', function(socket){
	socket.userData = { x:0, y:0, z:0, heading:0 };//Default values;

	console.log(`${socket.id} connected`);
	socket.emit('setId', { id:socket.id });
	socket.emit('remoteData',{ data:socket.data })


	//Handle the disconnection

    socket.on('disconnect', function(){

		console.log(`Character ${socket.id} disconnected`)
		socket.broadcast.emit('deleteCharacter', { id: socket.id });
    });

	//Iniitializated model data
	socket.on('init', function(data){
		console.log(`socket.init ${data.model}`);
		socket.userData.model = data.model;
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

		//socket.on('chat message', (msg) => {
    	//io.emit('chat message', { id: socket.id, message: data.message });
		console.log(`chat message:${data.id} ${data.message}`);
		io.to(data.id).emit('chat message', { id: socket.id, message: data.message });
	})
});
