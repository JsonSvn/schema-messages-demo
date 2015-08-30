Schema-messages demo
--------------------

This demo is showing an example use of Schema Messages - a library that creates binary representation of structured data for efficient network transmission. It uses [python implementation](https://github.com/tnajdek/schema-messages-python) on the server and [js implementation](https://github.com/tnajdek/schema-messages-js) in the browser.

For the demo purposes the client is requesting configurable amount of pixels of an image and the server is sending them using the schema-messages protocol. For comparision demo also allows usage of JSON (which requires less processing power but much more bandwidth to process). While it's a hilariously inefficent way of transmitting an image, it works as a nice benchmark of real-world application.

Live demo
---------
Live demo [is available](http://schema-sockets-demo.doppnet.com/)