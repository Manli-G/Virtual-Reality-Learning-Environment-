class Box{
	constructor(){
		if ( ! Detector.webgl ) Detector.addGetWebGLMessage();

		this.modes = Object.freeze({
			NONE:   Symbol("none"),
			PRELOAD: Symbol("preload"),
			INITIALISING:  Symbol("initialising"),
			ACTIVE: Symbol("active"),
		});
		this.mode = this.modes.NONE;

		this.container;
		this.character;
		this.cameras;
		this.camera;
		this.scene;
		this.renderer;
		this.animations = {};
		this.assetsPath = 'assets/';

		this.remoteCharacters = [];
		this.remoteColliders = [];
		this.initialisingCharacters = [];
		this.remoteData = [];


		this.container = document.createElement( 'div' );
		this.container.style.height = '100%';
		document.body.appendChild( this.container );


		const box = this;
		this.anims = ['Walking', 'Walking Backwards', 'Turn', 'Running', 'Pointing', 'Talking', 'Pointing Gesture'];

		const room = {
			assets:[`${this.assetsPath}fbx/room_G10.fbx`],	oncomplete: function(){
				box.init();
			}
		}

		this.anims.forEach( function(anim){ room.assets.push(`${box.assetsPath}fbx/anims/${anim}.fbx`)});


		this.mode = this.modes.PRELOAD;

		this.clock = new THREE.Clock();

		const preloader = new Preloader(room);

		window.onError = function(error){
			console.error(JSON.stringify(error));
		}
	}


	set activeCamera(object){
		this.cameras.active = object;
	}

	init() {

		// mode
		this.mode = this.modes.INITIALISING;

		// camera
		this.camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 10, 200000 );
		this.camera.position.set( 20000, 1000, 20000);

		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color( 0x00a0f0 );

		// light
		const ambient = new THREE.AmbientLight( 0xaaaaaa );
    this.scene.add( ambient );
    const light = new THREE.DirectionalLight( 0xaaaaaa );
    light.position.set( 30, 100, 40 );
    light.target.position.set( 0, 0, 0 );
		light.castShadow = true;

		// shadow
		const lightSize = 500;
    light.shadow.camera.near = 1;
    light.shadow.camera.far = 500;
		light.shadow.camera.left = light.shadow.camera.bottom = -lightSize;
		light.shadow.camera.right = light.shadow.camera.top = lightSize;

    light.shadow.bias = 0.0039;
    light.shadow.mapSize.width = 1024;
    light.shadow.mapSize.height = 1024;

		this.sun = light;
		this.scene.add(light);

		// model
		const loader = new THREE.FBXLoader();
		const box = this;

		this.character = new CharacterLocal(this);

		this.loadRoom(loader);

		// speechBubble
		this.speechBubble = new SpeechBubble(this, "", 150);
		this.speechBubble.mesh.position.set(0, 350, 0);

		// characterControl
		this.joystick = new JoyStick({
			onMove: this.CharacterControl,
			box: this
		});

		// renderer
		this.renderer = new THREE.WebGLRenderer( { antialias: true } );
		this.renderer.setPixelRatio( window.devicePixelRatio );
		this.renderer.setSize( window.innerWidth, window.innerHeight );
		this.renderer.shadowMap.enabled = true;
		this.container.appendChild( this.renderer.domElement );

		// addEventListener
		if ('ontouchstart' in window){
			window.addEventListener( 'touchdown', (event) => box.onMouseDown(event), false );
		}else{
			window.addEventListener( 'mousedown', (event) => box.onMouseDown(event), false );
		}

		window.addEventListener( 'resize', () => box.onWindowResize(), false );
	}

	loadRoom(loader){
		const box = this;
		loader.load(`${this.assetsPath}fbx/room_G10.fbx`, function(object){
			box.environment = object;
			object.scale.set(10,10,10);
			box.colliders = [];
			box.scene.add(object);
			object.traverse( function ( child ) {
				if ( child.isMesh ) {
					if (child.name.startsWith("proxy")){
						box.colliders.push(child);
						child.material.visible = false;
					}else{
						child.castShadow = true;
						child.receiveShadow = true;
					}
				}
			} );

			box.loadNextAnim(loader);
		})
	}

	loadNextAnim(loader){
		let anim = this.anims.pop();
		const box = this;
		loader.load( `${this.assetsPath}fbx/anims/${anim}.fbx`, function( object ){
			box.character.animations[anim] = object.animations[0];
			if (box.anims.length>0){
				box.loadNextAnim(loader);
			}else{
				delete box.anims;
				box.action = "Idle";
				box.mode = box.modes.ACTIVE;
				box.animate();
			}
		});
	}

	characterControl(forward, turn){
		turn = -turn;

		if (forward>0.3){
			if (this.character.action!='Walking') this.character.action = 'Walking';
		}else if (forward<-0.3){
			if (this.character.action!='Walking Backwards') this.character.action = 'Walking Backwards';
		}else{
			forward = 0;
			if (Math.abs(turn)>0.1){
				if (this.character.action != 'Turn') this.character.action = 'Turn';
			}else if (this.character.action!="Idle"){
				this.character.action = 'Idle';
			}
		}

		if (forward==0 && turn==0){
			delete this.character.motion;
		}else{
			this.character.motion = { forward, turn };
		}

		this.character.updateSocket();
	}

	createCameras(){

		const offset = new THREE.Vector3(0, 0, 1);
		const front = new THREE.Object3D();
		front.position.set(112, 100, 600);
		front.parent = this.character.object;
		const back = new THREE.Object3D();
		back.position.set(200, 300, -650);
		back.parent = this.character.object;
		const chat = new THREE.Object3D();
		chat.position.set(0, 200, -450);
		chat.parent = this.character.object;
		const wide = new THREE.Object3D();
		wide.position.set(178, 139, 1665);
		wide.parent = this.character.object;
		const overhead = new THREE.Object3D();
		overhead.position.set(0, 400, 0);
		overhead.parent = this.character.object;
		const collect = new THREE.Object3D();
		collect.position.set(40, 82, 94);
		collect.parent = this.character.object;
		this.cameras = { front, back, wide, overhead, collect, chat };
		this.activeCamera = this.cameras.back;
		//this.cameras.active = this.character.object;


		//this.camera.position.copy(this.character.object.position);
		//this.camera.lookAt(this.enviroment.position);
		//this.camera.lookAt( this.environment.position );

	}

	showMessage(msg, fontSize=20, onOK=null){
		const txt = document.getElementById('message_text');
		txt.innerHTML = msg;
		txt.style.fontSize = fontSize + 'px';
		const btn = document.getElementById('message_ok');
		const panel = document.getElementById('message');
		const box = this;
		if (onOK!=null){
			btn.onclick = function(){
				panel.style.display = 'none';
				onOK.call(box);
			}
		}else{
			btn.onclick = function(){
				panel.style.display = 'none';
			}
		}
		panel.style.display = 'flex';
	}

	onWindowResize() {
		this.camera.aspect = window.innerWidth / window.innerHeight;
		this.camera.updateProjectionMatrix();

		this.renderer.setSize( window.innerWidth, window.innerHeight );

	}

	updateremoteCharacters(dt){
		if (this.remoteData===undefined || this.remoteData.length == 0 || this.character===undefined || this.character.id===undefined) return;

		const newCharacters = [];
		const box = this;
		//Get all remoteCharacters from remoteData array
		const remoteCharacters = [];
		const remoteColliders = [];

		this.remoteData.forEach( function(data){
			if (box.character.id != data.id){
				//Is this character being initialised?
				let icharacter;
				box.initialisingCharacters.forEach( function(character){
					if (character.id == data.id) icharacter = character;
				});
				//If not being initialised check the remoteCharacters array
				if (icharacter===undefined){
					let rcharacter;
					box.remoteCharacters.forEach( function(character){
						if (character.id == data.id) rcharacter = character;
					});
					if (rcharacter===undefined){
						//Initialise character
						box.initialisingCharacters.push( new Character( box, data ));
					}else{
						//Character exists
						remoteCharacters.push(rcharacter);
						remoteColliders.push(rcharacter.collider);
					}
				}
			}
		});

		this.scene.children.forEach( function(object){
			if (object.userData.remoteCharacter && box.getRemoteCharacterById(object.userData.id)==undefined){
				box.scene.remove(object);
			}
		});

		this.remoteCharacters = remoteCharacters;
		this.remoteColliders = remoteColliders;
		this.remoteCharacters.forEach(function(character){ character.update( dt ); });
	}

	onMouseDown( event ) {
		if (this.remoteColliders===undefined || this.remoteColliders.length==0 || this.speechBubble===undefined || this.speechBubble.mesh===undefined) return;

		// calculate mouse position in normalized device coordinates
		// (-1 to +1) for both components
		const mouse = new THREE.Vector2();
		mouse.x = ( event.clientX / this.renderer.domElement.clientWidth ) * 2 - 1;
		mouse.y = - ( event.clientY / this.renderer.domElement.clientHeight ) * 2 + 1;

		const raycaster = new THREE.Raycaster();
		raycaster.setFromCamera( mouse, this.camera );

		const intersects = raycaster.intersectObjects( this.remoteColliders );
		const chat = document.getElementById('chat');

		if (intersects.length>0){
			const object = intersects[0].object;
			const characters = this.remoteCharacters.filter( function(character){
				if (character.collider!==undefined && character.collider==object){
					return true;
				}
			});
			if (characters.length>0){
				const character = characters[0];
				console.log(`onMouseDown: character ${character.id}`);
				this.speechBubble.character = character;
				this.speechBubble.update('');
				this.scene.add(this.speechBubble.mesh);
				this.chatSocketId = character.id;
				chat.style.bottom = '0px';
				this.activeCamera = this.cameras.chat;
			}
		}else{
			//Is the chat panel visible?
			if (chat.style.bottom=='0px' && (window.innerHeight - event.clientY)>40){
				console.log("onMouseDown: No character found");
				if (this.speechBubble.mesh.parent!==null) this.speechBubble.mesh.parent.remove(this.speechBubble.mesh);
				delete this.speechBubble.character;
				delete this.chatSocketId;
				chat.style.bottom = '-50px';
				this.activeCamera = this.cameras.back;
			}else{
				console.log("onMouseDown: typing");
			}
		}
	}

	getRemoteCharacterById(id){
		if (this.remoteCharacters===undefined || this.remoteCharacters.length==0) return;

		const characters = this.remoteCharacters.filter(function(character){
			if (character.id == id) return true;
		});

		if (characters.length==0) return;

		return characters[0];
	}

	animate() {
		const box = this;
		const dt = this.clock.getDelta();

		requestAnimationFrame( function(){ box.animate(); } );

		this.updateremoteCharacters(dt);

		if (this.character.mixer!=undefined && this.mode==this.modes.ACTIVE) this.character.mixer.update(dt);

		if (this.character.action=='Walking'){
			const elapsedTime = Date.now() - this.character.actionTime;
			if (elapsedTime>1000 && this.character.motion.forward>0){
				this.character.action = 'Running';
			}
		}

		if (this.character.motion !== undefined) this.character.move(dt);

		if (this.cameras!=undefined && this.cameras.active!=undefined && this.character!==undefined && this.character.object!==undefined){
			this.camera.position.lerp(this.cameras.active.getWorldPosition(new THREE.Vector3()),0.05);
			const pos = this.character.object.position.clone();

			if (this.cameras.active==this.cameras.chat){
				pos.y += 200;
			}else{
				pos.y += 300;
			}
			this.camera.lookAt(pos);
		}

		if (this.sun !== undefined){
			this.sun.position.copy( this.camera.position );
			this.sun.position.y += 10;
		}

		if (this.speechBubble!==undefined) this.speechBubble.show(this.camera.position);

		this.renderer.render( this.scene, this.camera );
	}
}

class Character{
	constructor(box, options){
		this.local = true;
		let model, colour;

		const colours = ['Black', 'Brown', 'White'];
		colour = colours[Math.floor(Math.random()*colours.length)];

		if (options===undefined){
			const people = ['BeachBabe', 'BusinessMan', 'Doctor', 'FireFighter', 'Housewife', 'Policeman', 'Prostitute', 'Punk', 'RiotCop', 'Roadworker', 'Robber', 'Sheriff', 'Streetman', 'Waitress'];
			model = people[Math.floor(Math.random()*people.length)];
		}else if (typeof options =='object'){
			this.local = false;
			this.options = options;
			this.id = options.id;
			model = options.model;
			colour = options.colour;
		}else{
			model = options;
		}
		this.model = model;
		this.colour = colour;
		this.box = box;
		this.animations = this.box.animations;

		const loader = new THREE.FBXLoader();
		const character = this;

		loader.load( `${box.assetsPath}fbx/people/${model}.fbx`, function ( object ) {

			object.mixer = new THREE.AnimationMixer( object );
			character.root = object;
			character.mixer = object.mixer;

			object.name = "Person";

			object.traverse( function ( child ) {
				if ( child.isMesh ) {
					child.castShadow = true;
					child.receiveShadow = true;
				}
			} );


			const textureLoader = new THREE.TextureLoader();

			textureLoader.load(`${box.assetsPath}images/SimplePeople_${model}_${colour}.png`, function(texture){
				object.traverse( function ( child ) {
					if ( child.isMesh ){
						child.material.map = texture;
					}
				} );
			});

			character.object = new THREE.Object3D();
			character.object.position.set(20000, 0, 20000);
			character.object.rotation.set(0, -1.5, 0);
			character.object.scale.set(6,6,6);

			character.object.add(object);
			if (character.deleted===undefined) box.scene.add(character.object);

			if (character.local){
				box.createCameras();
				//box.camera.position.copy(box.character.object.position);
				box.sun.target = box.character.object;
				box.animations.Idle = object.animations[0];
				if (character.initSocket!==undefined) character.initSocket();
			}else{
				const geometry = new THREE.BoxGeometry(100,300,100);
				const material = new THREE.MeshBasicMaterial({visible:false});
				const box = new THREE.Mesh(geometry, material);
				box.name = "Collider";
				box.position.set(0, 150, 0);
				character.object.add(box);
				character.collider = box;
				character.object.userData.id = character.id;
				character.object.userData.remoteCharacter = true;
				const characters = box.initialisingCharacters.splice(box.initialisingCharacters.indexOf(this), 1);
				box.remoteCharacters.push(characters[0]);
			}

			if (box.animations.Idle!==undefined) character.action = "Idle";
		} );
	}

	set action(name){
		//Make a copy of the clip if this is a remote character
		if (this.actionName == name) return;
		const clip = (this.local) ? this.animations[name] : THREE.AnimationClip.parse(THREE.AnimationClip.toJSON(this.animations[name]));
		const action = this.mixer.clipAction( clip );
        action.time = 0;
		this.mixer.stopAllAction();
		this.actionName = name;
		this.actionTime = Date.now();

		action.fadeIn(0.5);
		action.play();
	}

	get action(){
		return this.actionName;
	}

	update(dt){
		this.mixer.update(dt);

		if (this.box.remoteData.length>0){
			let found = false;
			for(let data of this.box.remoteData){
				if (data.id != this.id) continue;
				//Found the character
				this.object.position.set( data.x, data.y, data.z );
				const euler = new THREE.Euler(data.pb, data.heading, data.pb);
				this.object.quaternion.setFromEuler( euler );
				this.action = data.action;
				found = true;
			}
			if (!found) this.box.removeCharacters(this);
		}
	}
}

class CharacterLocal extends Character{
	constructor(box, model){
		super(box, model);

		const character = this;
		const socket = io.connect();

		// listening the 'setId' sent by the server
		socket.on('setId', function(data){
			character.id = data.id;
		});
		// listening the 'remoteData' sent by the server
		socket.on('remoteData', function(data){
			box.remoteData = data;
		});
		// listening the 'deletecharacter' sent by the server
		socket.on('deleteCharacter', function(data){
			const characters = box.remoteCharacters.filter(function(character){
				if (character.id == data.id){
					return character;
				}
			});

			if (characters.length>0){
				let index = box.remoteCharacters.indexOf(characters[0]);
				if (index!=-1){
					box.remoteCharacters.splice( index, 1 );
					box.scene.remove(characters[0].object);
				}
            }else{
                index = box.initialisingCharacters.indexOf(data.id);
                if (index!=-1){
                    const character = box.initialisingCharacters[index];
                    character.deleted = true;
                    box.initialisingCharacters.splice(index, 1);
                }
			}
		});

		socket.on('chat message', function(data){
			document.getElementById('chat').style.bottom = '0px';
			const character = box.getRemoteCharacterById(data.id);
			box.speechBubble.character = character;
			box.chatSocketId = character.id;
			box.activeCamera = box.cameras.chat;
			box.speechBubble.update(data.message);
		});

		$('#msg-form').submit(function(e){
			socket.emit('chat message', { id:box.chatSocketId, message:$('#m').val() });
			$('#m').val('');
			return false;
		});

		this.socket = socket;
	}

	initSocket(){
		console.log("CharacterLocal.");
		this.socket.emit('init', {
			model:this.model,
			colour: this.colour,
			x: this.object.position.x,
			y: this.object.position.y,
			z: this.object.position.z,
			h: this.object.rotation.y,
			pb: this.object.rotation.x
		});
	}

	updateSocket(){
		if (this.socket !== undefined){
			//console.log(`CharacterLocal.updateSocket - rotation(${this.object.rotation.x.toFixed(1)},${this.object.rotation.y.toFixed(1)},${this.object.rotation.z.toFixed(1)})`);
			this.socket.emit('update', {
				x: this.object.position.x,
				y: this.object.position.y,
				z: this.object.position.z,
				h: this.object.rotation.y,
				pb: this.object.rotation.x,
				action: this.action
			})
		}
	}

	move(dt){
		const pos = this.object.position.clone();
		pos.y += 60;
		let dir = new THREE.Vector3();
		this.object.getWorldDirection(dir);
		if (this.motion.forward<0) dir.negate();
		let raycaster = new THREE.Raycaster(pos, dir);
		let blocked = false;
		const colliders = this.box.colliders;

		if (colliders!==undefined){
			const intersect = raycaster.intersectObjects(colliders);
			if (intersect.length>0){
				if (intersect[0].distance<50) blocked = true;
			}
		}

		if (!blocked){
			if (this.motion.forward>0){
				const speed = (this.action=='Running') ? 500 : 150;
				this.object.translateZ(dt*speed);
			}else{
				this.object.translateZ(-dt*30);
			}
		}

		if (colliders!==undefined){
			//cast left
			dir.set(-1,0,0);
			dir.applyMatrix4(this.object.matrix);
			dir.normalize();
			raycaster = new THREE.Raycaster(pos, dir);

			let intersect = raycaster.intersectObjects(colliders);
			if (intersect.length>0){
				if (intersect[0].distance<50) this.object.translateX(100-intersect[0].distance);
			}

			//cast right
			dir.set(1,0,0);
			dir.applyMatrix4(this.object.matrix);
			dir.normalize();
			raycaster = new THREE.Raycaster(pos, dir);

			intersect = raycaster.intersectObjects(colliders);
			if (intersect.length>0){
				if (intersect[0].distance<50) this.object.translateX(intersect[0].distance-100);
			}

			//cast down
			dir.set(0,-1,0);
			pos.y += 200;
			raycaster = new THREE.Raycaster(pos, dir);
			const gravity = 30;

			intersect = raycaster.intersectObjects(colliders);
			if (intersect.length>0){
				const targetY = pos.y - intersect[0].distance;
				if (targetY > this.object.position.y){
					//Going up
					this.object.position.y = 0.8 * this.object.position.y + 0.2 * targetY;
					this.velocityY = 0;
				}else if (targetY < this.object.position.y){
					//Falling
					if (this.velocityY==undefined) this.velocityY = 0;
					this.velocityY += dt * gravity;
					this.object.position.y -= this.velocityY;
					if (this.object.position.y < targetY){
						this.velocityY = 0;
						this.object.position.y = targetY;
					}
				}
			}
		}

		this.object.rotateY(this.motion.turn*dt);

		this.updateSocket();
	}
}

class SpeechBubble{
	constructor(box, msg, size=1){
		this.config = { font:'Calibri', size:24, padding:10, colour:'#222', width:256, height:256 };

		const planeGeometry = new THREE.PlaneGeometry(size, size);
		const planeMaterial = new THREE.MeshBasicMaterial()
		this.mesh = new THREE.Mesh(planeGeometry, planeMaterial);
		box.scene.add(this.mesh);

		const self = this;
		const loader = new THREE.TextureLoader();
		loader.load(
			// resource URL
			`${box.assetsPath}images/speech.png`,

			// onLoad callback
			function ( texture ) {
				// in this example we create the material when the texture is loaded
				self.img = texture.image;
				self.mesh.material.map = texture;
				self.mesh.material.transparent = true;
				self.mesh.material.needsUpdate = true;
				if (msg!==undefined) self.update(msg);
			},

			// onProgress callback currently not supported
			undefined,

			// onError callback
			function ( err ) {
				console.error( 'An error happened.' );
			}
		);
	}

	update(msg){
		if (this.mesh===undefined) return;

		let context = this.context;

		if (this.mesh.userData.context===undefined){
			const canvas = this.createOffscreenCanvas(this.config.width, this.config.height);
			this.context = canvas.getContext('2d');
			context = this.context;
			context.font = `${this.config.size}pt ${this.config.font}`;
			context.fillStyle = this.config.colour;
			context.textAlign = 'center';
			this.mesh.material.map = new THREE.CanvasTexture(canvas);
		}

		const bg = this.img;
		context.clearRect(0, 0, this.config.width, this.config.height);
		context.drawImage(bg, 0, 0, bg.width, bg.height, 0, 0, this.config.width, this.config.height);
		this.wrapText(msg, context);

		this.mesh.material.map.needsUpdate = true;
	}

	createOffscreenCanvas(w, h) {
		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		return canvas;
	}

	wrapText(text, context){
		const words = text.split(' ');
        let line = '';
		const lines = [];
		const maxWidth = this.config.width - 2*this.config.padding;
		const lineHeight = this.config.size + 8;

		words.forEach( function(word){
			const testLine = `${line}${word} `;
        	const metrics = context.measureText(testLine);
        	const testWidth = metrics.width;
			if (testWidth > maxWidth) {
				lines.push(line);
				line = `${word} `;
			}else {
				line = testLine;
			}
		});

		if (line != '') lines.push(line);

		let y = (this.config.height - lines.length * lineHeight)/2;

		lines.forEach( function(line){
			context.fillText(line, 128, y);
			y += lineHeight;
		});
	}

	show(pos){
		if (this.mesh!==undefined && this.character!==undefined){
			this.mesh.position.set(this.character.object.position.x, this.character.object.position.y + 380, this.character.object.position.z);
			this.mesh.lookAt(pos);
		}
	}
}
