import React, {useEffect, useState} from 'react';
import {View, Text, StyleSheet, FlatList, TouchableOpacity} from 'react-native';
import MapView, {Marker} from 'react-native-maps';
import axios from 'axios';
import * as turf from '@turf/turf';
import BouncyCheckbox from 'react-native-bouncy-checkbox';

const LondonMapScreen = () => {
  const [busMarkers, setBusMarkers] = useState([]);
  const [fixedPoint, setFixedPoint] = useState({
    latitude: 51.5074,
    longitude: -0.1278,
  });
  const [errorMessage, setErrorMessage] = useState(null);
  const [selectedBusLines, setSelectedBusLines] = useState([]);
  const [busLines, setBusLines] = useState([]);
  const [showBusline, setShowBuslines] = useState(false);
  const [distances, setDistances] = useState([]);

  const minLatitude = 51.2867602;
  const maxLatitude = 51.6918741;
  const minLongitude = -0.510375;
  const maxLongitude = 0.3340155;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(
          'https://api.tfl.gov.uk/Line/Mode/bus',
        );
        const busLinesArr = response.data;
        setBusLines(busLinesArr);
      } catch (error) {
        if (error.response) {
          setErrorMessage(
            'Network error. Please check your internet connection.',
          );
        } else {
          setErrorMessage('An error occurred while fetching data.');
        }
      }
    };

    fetchData();
  }, []);
  useEffect(() => {
    const markers = [];

    const fetchData = async () => {
      for (const line of selectedBusLines) {
        const arrivalsResponse = await axios.get(
          `https://api.tfl.gov.uk/Line/${line}/Arrivals`,
        );
        const arrivals = arrivalsResponse.data;
        for (const bus of arrivals) {
          try {
            let latitude, longitude;

            const arrivalsRes = await axios.get(
              `https://geocode.maps.co/search?q={${bus.stationName},%20London}`,
            );

            latitude = arrivalsRes.data[0]?.lat;
            longitude = arrivalsRes.data[0]?.lon;

            // Check if the bus is within London area boundaries
            if (
              latitude >= minLatitude &&
              latitude <= maxLatitude &&
              longitude >= minLongitude &&
              longitude <= maxLongitude
            ) {
              markers.push({
                latitude: Number(latitude),
                longitude: Number(longitude),
              });
              setBusMarkers(markers);
            }
          } catch (error) {
            if (error.response) {
              setErrorMessage(
                'Api Limit is 2 requests/second, It may not give data.',
              );
            } else {
              setErrorMessage('An error occurred while fetching data.');
            }
          }
        }
      }
    };

    fetchData();

    // Choose an appropriate refresh rate for real-time data (e.g., use setInterval)
    const refreshInterval = 60000; // Refresh every 60 seconds (adjust as needed)
    const refreshTimer = setInterval(fetchData, refreshInterval);

    // Clear the interval when the component unmounts
    return () => {
      clearInterval(refreshTimer);
    };
  }, [minLongitude, selectedBusLines, fixedPoint]);

  const toggleBusLine = line => {
    if (selectedBusLines.includes(line.name)) {
      setSelectedBusLines(selectedBusLines.filter(id => id !== line.name));
    } else {
      setSelectedBusLines([...selectedBusLines, line.name]);
    }
  };
  useEffect(() => {
    const distance = busMarkers.map(marker => {
      const markerPoint = turf.point([marker.longitude, marker.latitude]);
      const fixedPointPoint = turf.point([
        fixedPoint.longitude,
        fixedPoint.latitude,
      ]);
      const options = {units: 'kilometers'}; // You can use 'miles' if you prefer

      return turf.distance(markerPoint, fixedPointPoint, options);
    });
    setDistances(distance);
  }, [busMarkers, fixedPoint]);

  // Calculate marker colors based on proximity to the fixed point

  const getMarkerColor = distance => {
    if (distance < 1) {
      return 'green'; // Less than 1 km
    } else if (distance >= 1 && distance <= 3) {
      return 'orange'; // Between 1 and 3 km
    } else {
      return 'red'; // More than 3 km
    }
  };

  // Function to handle map press and set the fixed point
  const handleMapPress = event => {
    const {latitude, longitude} = event.nativeEvent.coordinate;
    setFixedPoint({latitude, longitude});
  };

  const renderItem = ({item, index}) => (
    <BouncyCheckbox
      key={index.toString()}
      size={25}
      fillColor="black"
      unfillColor="#FFFFFF"
      text={item.id}
      isChecked={selectedBusLines.includes(item.id)}
      iconStyle={{borderColor: 'black'}}
      innerIconStyle={{borderWidth: 2}}
      onPress={() => toggleBusLine(item)}
    />
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.button}
        onPress={() => setShowBuslines(!showBusline)}>
        <Text style={styles.text}>
          {showBusline ? 'Show on Map' : 'Select Buslines'}
        </Text>
      </TouchableOpacity>
      <>
        {showBusline && (
          <FlatList
            data={busLines}
            renderItem={renderItem}
            keyExtractor={item => item.id}
          />
        )}

        <MapView
          style={styles.map}
          initialRegion={{
            latitude: 51.5074,
            longitude: -0.1278,
            latitudeDelta: 0.5,
            longitudeDelta: 0.5,
          }}
          onPress={handleMapPress}>
          {/* Display bus markers with colors based on proximity */}
          {busMarkers.map((marker, index) => {
            return (
              <Marker
                key={index.toString()}
                coordinate={{
                  latitude: marker.latitude,
                  longitude: marker.longitude,
                }}
                pinColor={getMarkerColor(distances[index])}
              />
            );
          })}

          {/* Display the fixed point marker if set */}
          {fixedPoint && <Marker coordinate={fixedPoint} pinColor="blue" />}
        </MapView>

        {/* Display coordinates of the fixed point */}
        {fixedPoint && (
          <Text style={styles.fixedPointText}>
            Fixed Point Coordinates: {fixedPoint.latitude},{' '}
            {fixedPoint.longitude}
          </Text>
        )}
        {errorMessage && (
          <View style={styles.errorMessage}>
            <Text>{errorMessage}</Text>
          </View>
        )}
      </>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorMessage: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'red',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: 'white',
    fontWeight: '400',
  },
  button: {
    height: 50,
    width: '70%',
    backgroundColor: 'red',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },

  map: {
    flex: 1,
  },
  fixedPointText: {
    alignSelf: 'center',
    marginVertical: 10,
    fontWeight: '500',
  },
});

export default LondonMapScreen;
