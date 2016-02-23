#!/usr/bin/env node

var SensorTag = require('./index');

var async = require('async');
var util = require('util');
var MongoClient = require('mongodb').MongoClient;

var tags = [];
var cnt = 1;

function discoverOne() {
  SensorTag.discover(onDiscover);
}

function onDiscover(sensorTag) {

    async.series([
      function (callback) {
        if(tags.indexOf(sensorTag.uuid) >= 0) {
          util.log('existed, sensorTag count is ' + (tags.length));
          util.log('tags: ' + tags);
        } else {
          util.log('new one, sensorTag count is ' + (tags.length));
          util.log('tags: ' + tags); 
          tags.push(sensorTag.uuid);
        }
        callback();      
      },
      function (callback) {
        console.log('>> start');
        sensorTag.connectAndSetUp(readDevice);
        sensorTag.once('disconnect', function () {
          util.log('>> disconnected!');
          sensorTag.removeListener('disconnect', function() {
            util.log('>> connection event is removed');
          });
          sensorTag.removeListener('gyroscopeChange', function() {
            util.log('>> gyroscopeChange event is removed');
          });
        });
        callback();
      },
      function (cllback) {
        console.log('>> end');
        discoverOne();
      }
    ]);

function readDevice(error) {
  if(error != undefined) {
    console.log('>> error: ', error);
  } else {
    console.log('>> readDeviceName');
    sensorTag.readDeviceName(function (error, deviceName) {
      console.log('\tdevice name = ' + deviceName);
      sensorTag.discoverServicesAndCharacteristics(function () {
        setTimeout(function () {
          console.log('>> discovered services and characteristics');
          gyroscopeHandler(sensorTag);
        }, 1000);
      }); // discoverServicesAndCharacteristics
    });
  }
}

}

function gyroscopeHandler(sensorTag) {
  sensorTag.enableGyroscope(function () {
    sensorTag.setGyroscopePeriod(500, function () {
      sensorTag.on('gyroscopeChange', function (x, y, z) {
        console.log('\tx = %d ', x);
        console.log('\ty = %d ', y);
        console.log('\tz = %d ', z);
        var dataObj = {'x-axis': x, 'y-axis': y, 'z-axis': z};
        writeDataToMongo(dataObj);
      });
      sensorTag.notifyGyroscope(function (err) {
        console.log('>> notifyGyroscope:', err);
      });
    }); // setGyroscopePeriod
  }); // enableGyroscope
}

function writeDataToMongo(dataObj) {
  MongoClient.connect("mongodb://jmbox.myqnapcloud.com:27018/iotDB", function(err, db) {
    if(err) {
      return console.dir(err);
    }
    var collection = db.collection('test');
    collection.insert(dataObj);
    console.log(">>> mongoDB inserted");
  });
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

