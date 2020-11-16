
class Vrle{
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
		this.avatar;
		this.cameras;
		this.camera;
		this.scene;
		this.renderer;
		this.animations = {};
		this.assetsPath = 'assets/';

		this.remoteAvatars = [];
		this.remoteColliders = [];
		this.initialisingAvatars = [];
		this.remoteData = [];

		this.messages = {
			text:[
			"Welcome to the room"
			],
			index:0
		}

		this.container = document.createElement( 'div' );
		this.container.style.height = '100%';
		document.body.appendChild( this.container );


		const vrle = this;
		this.anims = ['Walking','Walking Backwards','Turn'];

		const room = {
			assets:[
				`${this.assetsPath}fbx/classroom69.fbx`],oncomplete: function(){
				vrle.init();
			}
		}

		this.anims.forEach( function(anim){ room.assets.push(`${vrle.assetsPath}fbx/anims/${anim}.fbx`)});

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

		//mode
		this.mode = this.modes.INITIALISING;

		//camera
		this.camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 10, 20000 );

		//scene
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color( 0x000000 );

		//light
		const ambient = new THREE.AmbientLight( 0xaaaaaa );
    this.scene.add( ambient );

  	const light = new THREE.DirectionalLight( 0xaaaaaa );
    light.position.set( 30, 100, 40 );
    light.target.position.set( 0, 0, 0 );

		//shadow

    light.castShadow = true;

		const lightSize = 500;
    light.shadow.camera.near = 1;
    light.shadow.camera.far = 500;
		light.shadow.camera.left = light.shadow.camera.bottom = -lightSize;
		light.shadow.camera.right = light.shadow.camera.top = lightSize;

    light.shadow.bias = 0.0039;
    light.shadow.mapSize.width = 1024;
    light.shadow.mapSize.height = 1025;

		this.sun = light;
		this.scene.add(light);


		//Audio
		const listener = new THREE.AudioListener();
		this.camera.add(listener);
		this.scene.add(listener);

		// model
		const loader = new THREE.FBXLoader();
		const vrle = this;

		this.avatar = new AvatarLocal(this);

		this.loadRoom(loader);

		//speechBubble
		this.speechBubble = new SpeechBubble(this,"", 150);
		//this.speechBubble.mesh.position.set(0, 350, 0);

		//avatarControl
		this.joystick = new JoyStick({
			onMove: this.avatarControl,
			vrle: this
		});

		//renderer
		this.renderer = new THREE.WebGLRenderer( { antialias: true } );
		this.renderer.setPixelRatio( window.devicePixelRatio );
		this.renderer.setSize( window.innerWidth, window.innerHeight );
		this.renderer.shadowMap.enabled = true;
		this.container.appendChild( this.renderer.domElement );


		//addEventListener
		if ('ontouchstart' in window){
			window.addEventListener( 'touchdown', (event) => vrle.onMouseDown(event), false );
		}else{
			window.addEventListener( 'mousedown', (event) => vrle.onMouseDown(event), false );
		}

		window.addEventListener( 'resize', () => vrle.onWindowResize(), false );
	}

	loadRoom(loader){
		const vrle = this;
		loader.load(`${this.assetsPath}fbx/classroom69.fbx`, function(object){

			//vrle.avatar.loadModel();
			//console.log(`******************${vrle.avatar.nameLabel(name)}`);
			vrle.avatar.loadModel(vrle);
			vrle.environment = object;
			vrle.colliders = [];
			vrle.scene.add(object);

			// Obstacle handling
			object.traverse( function ( child ) {
				if ( child.isMesh ) {
					if(child.name.startsWith("Wall")){
						vrle.colliders.push(child);
						child.material.visible = true;
						}else{
							child.castShadow = true;
							child.receiveShadow = true;
						}

					}

			} );

/*
			const tloader = new THREE.CubeTextureLoader();
			tloader.setPath( `${vrle.assetsPath}/images/` );

			var textureCube = tloader.load( [
				'px.jpg', 'nx.jpg',
				'py.jpg', 'ny.jpg',
				'pz.jpg', 'nz.jpg'
			] );

			vrle.scene.background = textureCube;
*/
			vrle.loadNextAnim(loader);
		})
	}

	loadNextAnim(loader){

		let anim = this.anims.pop();
		const vrle = this;
		loader.load( `${this.assetsPath}fbx/anims/${anim}.fbx`, function( object ){
			vrle.avatar.animations[anim] = object.animations[0];
			if (vrle.anims.length>0){
				vrle.loadNextAnim(loader);
			}else{
				delete vrle.anims;
				vrle.action = "Idle";
				vrle.mode = vrle.modes.ACTIVE;
				vrle.animate();
			}
		});
	}

	avatarControl(forward, turn){
		turn = -turn;

			if (forward>0.3){
				if (this.avatar.action!='Walking') this.avatar.action = 'Walking';
			}else if (forward<-0.3){
				if (this.avatar.action!='Walking Backwards') this.avatar.action = 'Walking Backwards';
			}else{
				forward = 0;
				if (Math.abs(turn)>0.1){
					if (this.avatar.action != 'Turn') this.avatar.action = 'Turn';
				}else if (this.avatar.action!="Idle"){
					this.avatar.action = 'Idle';
				}
			}

		if (forward==0 && turn==0){
			delete this.avatar.motion;
		}else{
			this.avatar.motion = { forward, turn };
		}

		this.avatar.updateSocket();
	}

	createCameras(){
/*
		const offset = new THREE.Vector3(0, 10000, 0);
		const front = new THREE.Object3D();
		front.position.set(112, 100, 600);
		front.parent = this.avatar.object;
		const back = new THREE.Object3D();
		back.position.set(0, 200, -400);
		//back.rotation.set(0, -1.5, -1.5);
		back.parent = this.avatar.object;
		const chat = new THREE.Object3D();
		chat.position.set(0, 200, -450);
		chat.parent = this.avatar.object;
		const wide = new THREE.Object3D();
		wide.position.set(178, 139, 1665);
		wide.parent = this.avatar.object;
		const overhead = new THREE.Object3D();
		overhead.position.set(0, 300, -400);
		overhead.parent = this.avatar.object;
		const collect = new THREE.Object3D();
		collect.position.set(40, 82, 94);
		collect.parent = this.avatar.object;
		this.cameras = { offset,front, back, wide, overhead, collect, chat };

		this.activeCamera = this.cameras.back;
*/
		const cam = new THREE.Object3D();
		cam.position.x += this.avatar.object.position.x +200;
		cam.position.y += this.avatar.object.position.y +300;
		cam.position.z -= this.avatar.object.position.z -100;

		cam.parents = this.avatar.object;

		const back = new THREE.Object3D();
		back.position.set(0, 200, -400);
		back.parent = this.avatar.object;
		const chat = new THREE.Object3D();
		chat.position.set(0, 200, -450);
		chat.parent = this.avatar.object;

		this.cameras = { cam,back,chat };
		this.activeCamera = this.cameras.cam;

	}

	showMessage(msg, fontSize=24, onOK=null){
		const txt = document.getElementById('m');
		txt.innerHTML = msg;
		txt.style.fontSize = fontSize + 'px';
		const btn = document.getElementById('message_ok');
		const panel = document.getElementById('message');
		const vrle = this;
		if (onOK!=null){
			btn.onclick = function(){
				panel.style.display = 'none';
				onOK.call(vrle);
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

	updateRemoteAvatars(dt){
		if (this.remoteData===undefined || this.remoteData.length == 0 || this.avatar===undefined || this.avatar.id===undefined) return;

		const newAvatars = [];
		const vrle = this;
		//Get all remoteAvatars from remoteData array
		const remoteAvatars = [];
		const remoteColliders = [];



		this.remoteData.forEach( function(data){
			if (vrle.avatar.id != data.id){
				//Is this avatar being initialised?
				let iavatar;
				vrle.initialisingAvatars.forEach( function(avatar){
					if (avatar.id == data.id) iavatar = avatar;

				});
				//If not being initialised check the remoteAvatars array
				if (iavatar===undefined){
					let ravatar;
					vrle.remoteAvatars.forEach( function(avatar){
						if (avatar.id == data.id) ravatar = avatar;
					});
					if (ravatar===undefined){
						//Initialise avatar
						vrle.initialisingAvatars.push( new Avatar(vrle,data));
					}else{
						//Avatar exists
						remoteAvatars.push(ravatar);
						remoteColliders.push(ravatar.collider);
					}
				}
			}
		});

		this.scene.children.forEach( function(object){
			if (object.userData.remoteAvatar && vrle.getRemoteAvatarById(object.userData.id)==undefined){
				vrle.scene.remove(object);
			}
		});

		this.remoteAvatars = remoteAvatars;
		this.remoteColliders = remoteColliders;
		this.remoteAvatars.forEach(function(avatar){ avatar.update( dt ); });
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
			const avatars = this.remoteAvatars.filter( function(avatar){
				if (avatar.collider!==undefined && avatar.collider==object){
					return true;
				}
			});
			if (avatars.length>0){
				const avatar = avatars[0];
				console.log(`onMouseDown: avatar ${avatar.id}`);
				this.speechBubble.avatar = avatar;
				this.speechBubble.update('');
				this.scene.add(this.speechBubble.mesh);
				this.chatSocketId = avatar.id;
				chat.style.bottom = '0px';
				this.activeCamera = this.cameras.chat;
			}
		}else{
			//Is the chat panel visible?
			if (chat.style.bottom=='0px' && (window.innerHeight - event.clientY)>40){
				console.log("onMouseDown: No avatar found");
				if (this.speechBubble.mesh.parent!==null) this.speechBubble.mesh.parent.remove(this.speechBubble.mesh);
				delete this.speechBubble.avatar;
				delete this.chatSocketId;
				chat.style.bottom = '-50px';
				this.activeCamera = this.cameras.back;
			}else{
				console.log("onMouseDown: typing");
			}
		}
	}

	getRemoteAvatarById(id){
		if (this.remoteAvatars===undefined || this.remoteAvatars.length==0) return;

		const avatars = this.remoteAvatars.filter(function(avatar){
			if (avatar.id == id) return true;
		});

		if (avatars.length==0) return;

		return avatars[0];
		console.log(`${avatars[0]}`)
	}

	animate() {
		const vrle = this;
		const dt = this.clock.getDelta();

		requestAnimationFrame( function(){ vrle.animate(); } );

		this.updateRemoteAvatars(dt);

		if (this.avatar.mixer!=undefined && this.mode==this.modes.ACTIVE) this.avatar.mixer.update(dt);

		/*
		if (this.avatar.action=='Walking'){
			const elapsedTime = Date.now() - this.avatar.actionTime;
			if (elapsedTime>1000 && this.avatar.motion.forward>0){
				this.avatar.action = 'Running';
			}
		}
		*/
		if (this.avatar.motion !== undefined) this.avatar.move(dt);

		if (this.cameras!=undefined && this.cameras.active!=undefined && this.avatar!==undefined && this.avatar.object!==undefined){
			this.camera.position.lerp(this.cameras.active.getWorldPosition(new THREE.Vector3()), 0.05);
			const pos = this.avatar.object.position.clone();
			if (this.cameras.active==this.cameras.chat){
				pos.y += 200;
			}else{
				pos.y += 300;
			}
			//const posZ =
			this.camera.lookAt(pos);
			//this.activeCamera = pos;
		}

		if (this.sun !== undefined){
			this.sun.position.copy( this.camera.position );
			this.sun.position.y += 10;
		}

		if (this.speechBubble!==undefined) this.speechBubble.show(this.camera.position);
		//if (this.MakeTextSprite!==undefined) this.MakeTextSprite.show(this.camera.position);

		this.renderer.render( this.scene, this.camera );
	}



}

class Avatar{
	constructor(vrle,options){
		this.local = true;
		let model,name,role;

		if (options===undefined){
			//const avatar = ['Megan1','Megan2','Megan3','Megan4','Megan5'];
			const avatar = ['Megan'];
			model = avatar[Math.floor(Math.random()*avatar.length)];
			//this.modelChoose();
			console.log('options undefined');

		}else if (typeof options=='object'){
			this.local = false;
			this.options = options;
			this.id = options.id;
			this.name = options.name;
			model = options.model;
			//colour = options.colour;
		}else{
			model = options;
		}
		/*
		function testIng(model){
			if(vrle.avatar.modelChoose!==undefined){
				vrle.avatar.modelChoose();

			}
			model = vrle.avatar.model;
			return model;
		}
		*/
		this.loadModel(vrle);



	}

	loadModel(vrle){


			this.nameLabel(name);
			//console.log(`@@@@@@loadModel${this.nameLabel(name)}`);

			//this.role = role;
			//this.name = name;
			//this.model = model;

			this.vrle = vrle;
			this.animations = this.vrle.animations;

			const loader = new THREE.FBXLoader();
			const avatar = this;

			loader.load( `${vrle.assetsPath}fbx/avatar/${this.nameLabel(name)}.fbx`, function ( object ) {
				//console.log(`******************${avatar.nameLabel(name)}`);
				//vrle.avatar.modelChoose();

				console.log(`Loader:${vrle.avatar.model}`);
				object.mixer = new THREE.AnimationMixer( object );
				avatar.root = object;
				avatar.mixer = object.mixer;

				//object.name = "Person";

				object.traverse( function ( child ) {
					if ( child.isMesh ) {
						child.castShadow = true;
						child.receiveShadow = true;
					}
				} );

				if (avatar.nameLabel!==undefined) avatar.nameLabel(name);
				//console.log(`////////${avatar.nameLabel(name)}`)
				avatar.object = new THREE.Object3D();
				avatar.object.scale.set(2, 2, 2);
				//avatar.object.position.set(0, 0, 0);
				avatar.object.rotation.set(0, -1.5, 0);
				avatar.object.add(object);
				avatar.object.position.set(Math.random() * 50, 0, Math.random() * 50);
				//avatar.object.add(makeTextSprite);

				const makeTextSprite = new MakeTextSprite(`${avatar.nameLabel(name)}`);
				makeTextSprite.position.set(-50,100,10);
				makeTextSprite.rotation.set(0,-1.5,0);
				avatar.object.add(makeTextSprite);


				if (avatar.deleted===undefined) vrle.scene.add(avatar.object);

				if (avatar.local){
					vrle.createCameras();

					//vrle.avatar.local.parents(createCamera());
					vrle.sun.target = vrle.avatar.object;
					vrle.animations.Idle = object.animations[0];
					if (avatar.initSocket!==undefined) avatar.initSocket();


				}else{
					const geometry = new THREE.BoxGeometry(100,300,100);
					const material = new THREE.MeshBasicMaterial({visible:false});
					const box = new THREE.Mesh(geometry, material);
					box.name = "Collider";
					box.position.set(0, 150, 0);
					avatar.object.add(box);
					avatar.collider = box;
					avatar.object.userData.id = avatar.id;
					avatar.object.userData.remoteAvatar = true;
					const avatars = vrle.initialisingAvatars.splice(vrle.initialisingAvatars.indexOf(this), 1);
					vrle.remoteAvatars.push(avatars[0]);

				}

				if (vrle.animations.Idle!==undefined) avatar.action = "Idle";


			} );

	}

	set action(name){
		//Make a copy of the clip if this is a remote avatar
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

		if (this.vrle.remoteData.length>0){
			let found = false;
			for(let data of this.vrle.remoteData){
				if (data.id != this.id) continue;

				//Found the avatar
				this.object.position.set( data.x, data.y, data.z );
				const euler = new THREE.Euler(data.pb, data.heading, data.pb);
				this.object.quaternion.setFromEuler( euler );
				this.action = data.action;
				found = true;
			}
			if (!found) this.vrle.removeAvatar(this);
		}
	}
}

class AvatarLocal extends Avatar{
	constructor(vrle, model){
		super(vrle, model);
		const avatar = this;
		const name = null;

		const socket = io.connect();


		socket.on('role',function(data){
			avatar.role = data;
			console.log(`Role is:${avatar.role}`);
			avatar.modelChoose();

		});



		socket.on('setId', function(data){
			avatar.id = data.id;
			console.log(`setID:${avatar.id}`);

		});

		socket.on('nameLabel',function(data){
			avatar.name = data;
			console.log(`Username:${avatar.name}`);
			avatar.nameLabel();

		});


		//avatar.nameLabel();
		socket.on('remoteData', function(data){
			vrle.remoteData = data;

		});



		socket.on('deleteAvatar', function(data){
			const avatars = vrle.remoteAvatars.filter(function(avatar){
				if (avatar.id == data.id){
					return avatar;
				}
			});

			if (avatars.length>0){
				let index = vrle.remoteAvatars.indexOf(avatars[0]);
				if (index!=-1){
					vrle.remoteAvatars.splice( index, 1 );
					vrle.scene.remove(avatars[0].object);
				}
      }else{
                index = vrle.initialisingAvatars.indexOf(data.id);
                if (index!=-1){
                    const avatar = vrle.initialisingAvatars[index];
                    avatar.deleted = true;
                    vrle.initialisingAvatars.splice(index, 1);
                }
			}
		});
		$('#msg-form').submit(function(e){
			socket.emit('chat message', { id:vrle.chatSocketId, message:$('#m').val() });
			$('#m').val('');
			return false;
		});
		socket.on('chat message', function(data){
			document.getElementById('chat').style.bottom = '0px';
			const avatar = vrle.getRemoteAvatarById(data.id);
			vrle.speechBubble.avatar = avatar;
			vrle.chatSocketId = avatar.id;
			vrle.activeCamera = vrle.cameras.chat;
			vrle.speechBubble.update(data.message);
		});

		this.socket = socket;
	}

	nameLabel(name){
		//console.log("AvatarLocal.");
		//console.log(`********${this.name}`);
		name = this.name;
		//console.log(`########${name}`);
		return name;

	}

	modelChoose(){
		//console.log("AvatarLocal.");

		console.log(`********${this.role}`);

		const roles = this.roles;
		const avatars = ['teacher','student'];
		const teacher = ['Josh'];
		const student = ['Megan1','Megan2','Megan3',];
		//model = avatar[Math.floor(Math.random()*avatar.length)];
		if (this.role == 'Teacher'){
			console.log('Teacher')
			this.roles =  avatars[0];
			this.model = teacher[Math.floor(Math.random()*teacher.length)];
			var loader = new THREE.FBXLoader();

		}else if (this.role === 'Student'){
			console.log('Student')
			this.roles =  avatars[1];
			this.model = student[Math.floor(Math.random()*student.length)];
			//loader.load( `${vrle.assetsPath}fbx/avatar/${model}.fbx`);
		}
		console.log(`${this.roles}&${this.model}`);

	}

	initSocket(){
		//console.log("AvatarLocal.");
		this.socket.emit('init', {
			role:this.role,
			name:this.name,
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
			//console.log(`AvatarLocal.updateSocket - rotation(${this.object.rotation.x.toFixed(1)},${this.object.rotation.y.toFixed(1)},${this.object.rotation.z.toFixed(1)})`);
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
		pos.y += 20;
		let dir = new THREE.Vector3();
		this.object.getWorldDirection(dir);
		if (this.motion.forward<0) dir.negate();
		let raycaster = new THREE.Raycaster(pos, dir);
		let blocked = false;
		const colliders = this.vrle.colliders;

		if (colliders!==undefined){
			const intersect = raycaster.intersectObjects(colliders);
			if (intersect.length>0){
				if (intersect[0].distance<50) blocked = true;
			}
		}

		if (!blocked){
			if (this.motion.forward>0){
				const speed = (this.action=='Walking') ? 500 : 150;
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
	constructor(vrle, msg, size=1){
		this.config = { font:'Calibri', size:24, padding:10, colour:'#222', width:256, height:256 };

		const planeGeometry = new THREE.PlaneGeometry(size, size);
		const planeMaterial = new THREE.MeshBasicMaterial()
		this.mesh = new THREE.Mesh(planeGeometry, planeMaterial);
		vrle.scene.add(this.mesh);

		const self = this;
		const loader = new THREE.TextureLoader();
		loader.load(
			// resource URL
			`${vrle.assetsPath}images/speech.png`,

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
		if (this.mesh!==undefined && this.avatar!==undefined){
			this.mesh.position.set(this.avatar.object.position.x, this.avatar.object.position.y , this.avatar.object.position.z);
			this.mesh.lookAt(pos);
		}
	}
}

class MakeTextSprite{

	constructor(message,parameters){
			const vrle = this;

			if ( parameters === undefined ) parameters = {};

			const fontface = parameters.hasOwnProperty("fontface") ?
				parameters["fontface"] : "Arial";

			const fontsize = parameters.hasOwnProperty("fontsize") ?
				parameters["fontsize"] : 18;

			const borderThickness = parameters.hasOwnProperty("borderThickness") ?
				parameters["borderThickness"] : 3;

			const borderColor = parameters.hasOwnProperty("borderColor") ?
				parameters["borderColor"] : { r:0, g:0, b:0, a:1.0 };

			const backgroundColor = parameters.hasOwnProperty("backgroundColor") ?
				parameters["backgroundColor"] : { r:255, g:255, b:255, a:1.0 };

			const canvas = document.createElement('canvas');
			const context = canvas.getContext('2d');
			context.font = "Bold " + fontsize + "px " + fontface;

			// get size data (height depends only on font size)
			const metrics = context.measureText( message );
			const textWidth = metrics.width;

			// background color
			context.fillStyle   = "rgba(" + backgroundColor.r + "," + backgroundColor.g + ","
											+ backgroundColor.b + "," + backgroundColor.a + ")";
			// border color
			context.strokeStyle = "rgba(" + borderColor.r + "," + borderColor.g + ","
											+ borderColor.b + "," + borderColor.a + ")";

			context.lineWidth = borderThickness;
			this.roundRect(context, borderThickness/2, borderThickness/2, textWidth + borderThickness, fontsize * 1.4 + borderThickness, 6);
			// 1.4 is extra height factor for text below baseline: g,j,p,q.

			// text color
			context.fillStyle = "rgba(0, 0, 0, 1.0)";

			context.fillText( message, borderThickness, fontsize + borderThickness);

			// canvas contents will be used for a texture
			const texture = new THREE.Texture(canvas)
			texture.needsUpdate = true;

			const spriteMaterial = new THREE.SpriteMaterial(
				{ map: texture} );
			const sprite = new THREE.Sprite( spriteMaterial );
			sprite.scale.set(400,250,1.0);

			return sprite;

		}

	roundRect(ctx, x, y, w, h, r){
		 const vrle = this;
			ctx.beginPath();
			ctx.moveTo(x+r, y);
			ctx.lineTo(x+w-r, y);
			ctx.quadraticCurveTo(x+w, y, x+w, y+r);
			ctx.lineTo(x+w, y+h-r);
			ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
			ctx.lineTo(x+r, y+h);
			ctx.quadraticCurveTo(x, y+h, x, y+h-r);
			ctx.lineTo(x, y+r);
			ctx.quadraticCurveTo(x, y, x+r, y);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();

		}

	show(pos){
		if (this.makeTextSprite!==undefined && this.avatar!==undefined){
			this.makeTextSprite.position.set(this.avatar.object.position.x, this.avatar.object.position.y + 380, this.avatar.object.position.z);
			this.makeTextSprite.lookAt(pos);
		}
	}

	}
