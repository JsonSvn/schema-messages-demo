#!/usr/bin/env python
import asyncio
import websockets
import random
import json
import struct
import msgpack

from PIL import Image
from schemamessages import MessageFactory, unpack_mesages, pack_messages
import messages_pb2


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
protocols = dict()
reply_functions = dict()

print("Ready for WS connections!")

def set_protocol(message, websocket):
	global protocols
	if(message in reply_functions.keys()):
		print('protocol set to {}'.format(message))
		protocols[websocket.id] = message

def reply_json(message, websocket):
	global pointers;
	
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
		msg = {
			'x': x,
			'y': y,
			'r': r,
			'g': g,
			'b': b
		}
		reply_messages.append(msg)
		pointers[websocket.id] += 1
	packed = json.dumps(reply_messages)
	yield from websocket.send(packed)


def reply_schema_msg(message, websocket):
	global pointers

	unpacked = unpack_mesages(message, factory)
	pixels_count = unpacked[0]['pixels']
	reply_messages = []

	for i in range(pixels_count):
		if(pointers[websocket.id] >= len(positions)):
			pointers[websocket.id] = 0
			break
		position = positions[pointers[websocket.id]]
		y = position // width
		x = position - (y * width)
		(r,g,b) = pixels[position];
		msg = factory.get('DataMessage')(x=x, y=y, r=r, g=g, b=b)
		reply_messages.append(msg)
		pointers[websocket.id] += 1
	packed = pack_messages(reply_messages)
	yield from websocket.send(packed)


def reply_protobuf(message, websocket):
	global pointers

	unpacked = messages_pb2.RequestMessage.FromString(message)
	pixels_count = unpacked.pixel_count
	reply_messages = []

	for i in range(pixels_count):
		if(pointers[websocket.id] >= len(positions)):
			pointers[websocket.id] = 0
			break
		position = positions[pointers[websocket.id]]
		y = position // width
		x = position - (y * width)
		(r,g,b) = pixels[position];
		msg = messages_pb2.DataMessage()
		msg.x = x
		msg.y = y
		msg.r = r
		msg.g = g
		msg.b = b
		msg_serialized = msg.SerializeToString()
		msg_length = len(msg_serialized)
		msg_serialized = struct.pack('I', msg_length) + msg_serialized
		reply_messages.append(msg_serialized)
		pointers[websocket.id] += 1
	packed = b''.join(reply_messages)
	yield from websocket.send(packed)
	
def reply_msgpack(message, websocket):
	global pointers;
	unpacked = msgpack.unpackb(message, encoding='utf-8')
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
		msg = {
			'x': x,
			'y': y,
			'r': r,
			'g': g,
			'b': b
		}
		reply_messages.append(msg)
		pointers[websocket.id] += 1
	packed = msgpack.packb(reply_messages, encoding='utf-8')
	yield from websocket.send(packed)


reply_functions = {
	'json': reply_json,
	'schema-messages': reply_schema_msg,
	'protobuf': reply_protobuf,
	'msgpack': reply_msgpack,
}


def reply(message, websocket):
	global pointers

	if(not websocket.id in pointers):
		pointers[websocket.id] = 0;
	
	yield from reply_functions[protocols[websocket.id]](message, websocket)

@asyncio.coroutine
def handler(websocket, path):
	global protocols
	websocket.id = id(websocket)
	print('New websocket {}'.format(websocket.id))
	while True:
		message = yield from websocket.recv()
		if message is None:
			break
		if(not websocket.id in protocols):
			set_protocol(message, websocket)
		else:
			yield from reply(message, websocket)


start_server = websockets.serve(handler, '0.0.0.0', 8765)

asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()