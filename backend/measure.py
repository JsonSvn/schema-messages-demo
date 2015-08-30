#!/usr/bin/env python
import timeit
from schemamessages import MessageFactory, unpack_mesages, pack_messages

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

def makemsg():
	factory = MessageFactory(schema)
	msg = factory.get('DataMessage')(x=5, y=6, r=7, g=99, b=125)
	packed = msg.pack()


print(timeit.timeit("makemsg()", setup="from __main__ import makemsg", number=10000))
