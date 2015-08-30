#!/usr/bin/env python
import asyncio
import websockets
import random
import json
from PIL import Image
from schemamessages import MessageFactory, unpack_mesages, pack_messages


print("Building schema...")
schema = {
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
}
factory = MessageFactory(schema)

print("Processing the image...")
image = Image.open('image.jpg');
width, height = image.size
pixels = list(image.getdata())
positions = list(range(len(pixels)))
random.shuffle(positions)
pointers = dict()

print("Ready for WS connections!")

def reply(message, websocket):
	global pointers
	if(not websocket.id in pointers):
		pointers[websocket.id] = 0;

	if(type(message) == bytes):
		unpacked = unpack_mesages(message, factory)
		pixels_count = unpacked[0]['pixels']
	else:
		unpacked = json.loads(message)
		pixels_count = int(unpacked['pixels'])
	reply_messages = []

	for i in range(pixels_count):
		if(pointers[websocket.id] >= len(positions)):
			pointers[websocket.id] = 0
			break
		position = positions[pointers[websocket.id]]
		y = position // width
		x = position - (y * width)
		(r,g,b) = pixels[position];
		if(type(message) == bytes):
			msg = factory.get('DataMessage')(x=x, y=y, r=r, g=g, b=b)
		else:
			msg = {
				'x': x,
				'y': y,
				'r': r,
				'g': g,
				'b': b
			}
		reply_messages.append(msg)
		pointers[websocket.id] += 1

	if(type(message) == bytes):
		packed = pack_messages(reply_messages)
	else:
		packed = json.dumps(reply_messages)
	yield from websocket.send(packed)


@asyncio.coroutine
def handler(websocket, path):
	websocket.id = id(websocket)
	print('New websocket {}'.format(websocket.id))
	while True:
		message = yield from websocket.recv()
		if message is None:
			break
		yield from reply(message, websocket)


start_server = websockets.serve(handler, '0.0.0.0', 8765)

asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()