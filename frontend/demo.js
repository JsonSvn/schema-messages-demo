(function() {
	var schema = {
			'DataMessage': {
			'format': {
				'x': 'ushort',
				'y': 'ushort',
				'r': 'ubyte',
				'g': 'ubyte',
				'b': 'ubyte'
			}
		},
		'RequestMessage': {
			'format': {
				'pixels': 'ushort'
			}
		}
	};

	var factory = new MessageFactory(schema),
		RequestMessage = factory.get('RequestMessage'),
		canvas = document.getElementById('canvas'),
		ctx = canvas.getContext('2d'),
		singlePixelImgData = ctx.createImageData(1, 1),
		singlePixelData = singlePixelImgData.data,
		pixelPerMsgField = document.getElementById('pixels-per-msg'),
		noDrawField = document.getElementById('no-draw-checkbox'),
		protocolField = document.getElementById('protocol-selector'),
		timeTakenField = document.getElementById('time-taken'),
		goBtn = document.getElementById('go-button'),
		protoFile = dcodeIO.ProtoBuf.loadProtoFile("./messages.proto"),
		reqMsg, socket, pixelCounter, countTarget, startT;

	canvas.width = 300;
	canvas.height = 449;
	countTarget = canvas.width * canvas.height;
	singlePixelData[3] = 255;
	


	function makeReqMsg() {
		switch(protocolField.value) {
			case 'json':
			return JSON.stringify({
				'pixels': pixelPerMsgField.value
			});

			case 'schema-messages':
			reqMsg = new RequestMessage();
			reqMsg.data.pixels = pixelPerMsgField.value;
			return reqMsg.pack();

			case 'protobuf':
			var ReqMsgClass = protoFile.build('demo.RequestMessage');
			reqMsg = new ReqMsgClass(parseInt(pixelPerMsgField.value, 10));
			return reqMsg.toArrayBuffer();

			default:
			console.warn("unsupported protocol selected!");
			return '';
		}
	}

	function draw(pixelmsgs) {
		for(var i = 0, len = pixelmsgs.length; i < len; i++) {
			singlePixelData[0] = pixelmsgs[i].data ? pixelmsgs[i].data.r : pixelmsgs[i].r;
			singlePixelData[1] = pixelmsgs[i].data ? pixelmsgs[i].data.g : pixelmsgs[i].g;
			singlePixelData[2] = pixelmsgs[i].data ? pixelmsgs[i].data.b : pixelmsgs[i].b;
			ctx.putImageData(
				singlePixelImgData,
				pixelmsgs[i].data ? pixelmsgs[i].data.x : pixelmsgs[i].x,
				pixelmsgs[i].data ? pixelmsgs[i].data.y : pixelmsgs[i].y
			);
		}
	}

	function toggleControls(enable) {
		var controls = [goBtn, pixelPerMsgField, noDrawField, protocolField];
		
		controls.forEach(function(el) {
			if(enable) {
				el.removeAttribute('disabled');
				goBtn.textContent = "GO!";
			} else {
				el.setAttribute('disabled', 'disabled');
				goBtn.textContent = "Please Wait";
			}
		});
	}

	goBtn.onclick = function() {
		pixelCounter = 0;
		socket = new WebSocket("ws://" + window.location.hostname + ":8765");
		socket.binaryType = 'arraybuffer';

		socket.onopen = function() {
			socket.send(protocolField.value);
			toggleControls(false);
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			startT = window.performance.now();
			reqMsg = makeReqMsg();
			socket.send(reqMsg);
		};

		socket.onmessage = function(msg) {
			var pixeldata;

			switch(protocolField.value) {
				case 'json':
				pixeldata = JSON.parse(msg.data);
				break;

				case 'schema-messages':
				pixeldata = factory.unpackMessages(msg.data);
				break;

				case 'protobuf':
				DataMsgClass = protoFile.build('demo.DataMessage');
				var last = 4,
					view = new Uint32Array(msg.data.slice(0, 4)),
					next_msg_length = view[0],
					messages = [],
					i;

				while(next_msg_length) {
					messages.push(msg.data.slice(last, last + next_msg_length));
					view = new Uint32Array(msg.data.slice(last + next_msg_length, last + next_msg_length + 4));
					last = last + next_msg_length + 4;
					next_msg_length = view[0];
				}

				pixeldata = [];
				for(i = 0, len = messages.length; i < len; i++) {
					if(messages[i].byteLength) {
						pixeldata.push(DataMsgClass.decode(messages[i]));
					}
				}
				break;
			}

			if(!noDrawField.checked) {
				draw(pixeldata);
			}

			pixelCounter += pixeldata.length;
			if(pixelCounter < countTarget) {
				socket.send(reqMsg);	
			} else {
				toggleControls(true);
				timeTakenField.value = (window.performance.now() - startT) / 1000;
				socket.close();
			}
		};
	};
})();