#!/usr/bin/env node

var SensorTag = require('./index');

var async = require('async');
var util = require('util');
//var MongoClient = require('mongodb').MongoClient;

var d = new Date();

var mqtt = require('mqtt');
var client = mqtt.connect('mqtt://10.23.7.8');

var tags = [];
var cnt = 1;
var gSystemId = '';

function discoverOne() {
  SensorTag.discover(onDiscover);
}

function onDiscover(sensorTag) {

  console.log('>> start');
  sensorTag.connectAndSetUp(readDevice);

  sensorTag.on('disconnect', function () {
    util.log('>> disconnected!');
    sensorTag.disableGyroscope(function () {
      util.log('>> disable gyroscope');
    });
    sensorTag.removeListener('disconnect', function() {
      util.log('>> connection event is removed');
    });
    sensorTag.removeListener('gyroscopeChange', function() {
      util.log('>> gyroscopeChange event is removed');
    });
  });
  console.log('>> end');
  
  function readDevice(error) {
    if(error) {
      return console.dir(error);
    } else {
      console.log('>> readDeviceName');
      sensorTag.readDeviceName(function (error, deviceName) {
        console.log('\tdevice name = ' + deviceName);
        gSystemId = deviceName;
        sensorTag.discoverServicesAndCharacteristics(function () {
          setTimeout(function () {
            console.log('>> discovered services and characteristics');
            gyroscopeHandler(sensorTag);
          }, 1000);
        }); // discoverServicesAndCharacteristics
      });
    }
  }

  function Handler(sensorTag) {
    sensorTag.enableGyroscope(function () {
      sensorTag.setGyroscopePeriod(2000, function () {
        sensorTag.on('gyroscopeChange', function (x, y, z) {
          console.log('\tx = %d ', x);
          console.log('\ty = %d ', y);
          console.log('\tz = %d ', z);
          var dataObj = {'x-axis': x, 'y-axis': y, 'z-axis': z, cur_date: new Date()};
          writeDataToMongo(dataObj);
        });
        sensorTag.notifyGyroscope(function (err) {
          console.log('>> notifyGyroscope:', err);
        });
      }); // setGyroscopePeriod
    }); // enableGyroscope
  }
  
  function gyroscopeHandler(sensorTag) {
    sensorTag.enableGyroscope(function () {
      sensorTag.setGyroscopePeriod(2000, function () {
        sensorTag.on('gyroscopeChange', function (x, y, z) {
          async.parallel([
		function(callback) {
	          var dataObj = {x: x, y: y, z: z};
		  callback(null, dataObj);			
		},
                function(callback) {
	          //sensorTag.readSerialNumber(function(error, serialNumber) {
        	    //console.log(">> systemId: " + serialNumber);
                    callback(null, sensorTag.id);
	          //});
                }
          ],
		// optional callback
		function(err, results){
		    // results is now equal to ['one', 'two']
		  d = new Date();
		  writeDataToMqtt(results[1] + '/x-axis', results[0].x + ":" + d.toGMTString());
	          writeDataToMqtt(results[1] + '/y-axis', results[0].y + ":" + d.toGMTString());
	          writeDataToMqtt(results[1] + '/z-axis', results[0].z + ":" + d.toGMTString());
		}
	  );
        });
        sensorTag.notifyGyroscope(function (err) {
          console.log('>> notifyGyroscope:', err);
        });
      }); // setGyroscopePeriod
    }); // enableGyroscope
  }
  
  function writeDataToMongo(dataObj) {
    MongoClient.connect("mongodb://developer:hist@ds062898.mongolab.com:62898/azure", function(err, db) {
      if(err) {
        return console.dir(err);
      }
      var collection = db.collection('test');
      collection.insert(dataObj);
      console.log(">>> mongoDB inserted");
    });
  }
  
  function writeDataToMqtt(topic, dataObj) {
    client.publish('sensors/' + topic, dataObj);
    console.log(">>> mqtt published: " + topic + ", value: " + dataObj.toString());
  }

  function readSystemId() {
    console.log('>> readSystemId');
    sensorTag.readSystemId(function (error, systemId) {
      console.log('\tsystem id = ' + systemId);
      setTimeout(function () {
        readDevice(); // start over again
      }, 1000);
    });
  }
  
  discoverOne();
  
}

discoverOne();
