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
		useJsonField = document.getElementById('use-json-checkbox'),
		timeTakenField = document.getElementById('time-taken'),
		goBtn = document.getElementById('go-button'),
		reqMsg, socket, pixelCounter, countTarget, startT;

	canvas.width = 300;
	canvas.height = 449;
	countTarget = canvas.width * canvas.height;
	singlePixelData[3] = 255;
	


	function makeReqMsg() {
		if(useJsonField.checked) {
			return JSON.stringify({
				'pixels': pixelPerMsgField.value
			});
		} else {
			reqMsg = new RequestMessage();
			reqMsg.data.pixels = pixelPerMsgField.value;
			return reqMsg.pack();
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
		var controls = [goBtn, pixelPerMsgField, noDrawField, useJsonField];
		
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
		reqMsg = makeReqMsg(useJsonField.checked);
		pixelCounter = 0;
		socket = new WebSocket("ws://" + window.location.hostname + ":8765");
		socket.binaryType = 'arraybuffer';

		socket.onopen = function() {
			toggleControls(false);
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			startT = window.performance.now();
			socket.send(reqMsg);
		};

		socket.onmessage = function(msg) {
			var pixeldata;

			if(msg.data instanceof ArrayBuffer) {
				pixeldata = factory.unpackMessages(msg.data);
			} else {
				pixeldata = JSON.parse(msg.data);
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