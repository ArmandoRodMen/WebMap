

    mapboxgl.accessToken = 'pk.eyJ1Ijoiam9zcy1nZXgiLCJhIjoiY2wzb3R2aTZmMG1pZTNmcG54eTFkZWx0NyJ9.gfVtYkUcH-W1YAwdgJRpUQ';

// Default coordinates
    const defaultCoordinates = [-99.1332, 19.4326];

    // Create a map with default coordinates
    const map = new mapboxgl.Map({
        container: 'map',
        center: defaultCoordinates,
        zoom: 15.1,
        pitch: 62,
        bearing: -20
    });

    // Try to get the user's location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                // Use the user's location if available
                const userCoordinates = [position.coords.longitude, position.coords.latitude];
                map.setCenter(userCoordinates);
            },
            (error) => {
                // If there's an error or the user denies location access, use default coordinates
                console.error('Error getting user location:', error);
            }
        );
    } else {
        // If geolocation is not supported, use default coordinates
        console.error('Geolocation is not supported by your browser');
    }

    // Add geolocate control to the map.
    map.addControl(
        new mapboxgl.GeolocateControl({
            positionOptions: {
                enableHighAccuracy: true
            },
            // When active the map will receive updates to the device's location as it changes.
            trackUserLocation: true,
            // Draw an arrow next to the location dot to indicate which direction the device is heading.
            showUserHeading: true
        })
    );

    map.addControl(new mapboxgl.NavigationControl());

    map.addControl(new mapboxgl.ScaleControl());

    map.addControl(new mapboxgl.FullscreenControl());


    const size = 200;
 
    // This implements `StyleImageInterface`
    // to draw a pulsing dot icon on the map.
    const pulsingDot = {
        width: size,
        height: size,
        data: new Uint8Array(size * size * 4),
            
        // When the layer is added to the map,
        // get the rendering context for the map canvas.
        onAdd: function () {
            const canvas = document.createElement('canvas');
            canvas.width = this.width;
            canvas.height = this.height;
            this.context = canvas.getContext('2d');
        },
            
        // Call once before every frame where the icon will be used.
        render: function () {
            const duration = 1000;
            const t = (performance.now() % duration) / duration;
            
            const radius = (size / 2) * 0.3;
            const outerRadius = (size / 2) * 0.7 * t + radius;
            const context = this.context;
            
            // Draw the outer circle.
            context.clearRect(0, 0, this.width, this.height);
            context.beginPath();
            context.arc(
            this.width / 2,
            this.height / 2,
            outerRadius,
            0,
            Math.PI * 2
            );
            context.fillStyle = `rgba(255, 200, 200, ${1 - t})`;
            context.fill();
            
            // Draw the inner circle.
            context.beginPath();
            context.arc(
            this.width / 2,
            this.height / 2,
            radius,
            0,
            Math.PI * 2
            );
            context.fillStyle = 'rgba(255, 100, 100, 1)';
            context.strokeStyle = 'white';
            context.lineWidth = 2 + 4 * (1 - t);
            context.fill();
            context.stroke();
            
            // Update this image's data with data from the canvas.
            this.data = context.getImageData(
                0,
                0,
                this.width,
                this.height
            ).data;
            
            // Continuously repaint the map, resulting
            // in the smooth animation of the dot.
            map.triggerRepaint();
            
            // Return `true` to let the map know that the image was updated.
            return true;
    }};
    /*
    map.loadImage(
        'https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png',
        (error, image) => {
            if (error) throw error;
            map.addImage('custom-marker', image);
        }
    );*/
    

    map.on('load', () => {

        map.addImage('pulsing-dot', pulsingDot, { pixelRatio: 2 });

        map.addSource('dot-point', {
            'type': 'geojson',
            'data': {
            'type': 'FeatureCollection',
            'features': [{
            'type': 'Feature',
            'geometry': {
            'type': 'Point',
            'coordinates': [-99.1542288, 19.436365] 
            }}]}});

            map.addLayer({
                'id': 'layer-with-pulsing-dot',
                'type': 'symbol',
                'source': 'dot-point',
                'layout': {
                    'icon-image': 'pulsing-dot'
                }
                });

                
                fetch('https://gbfs.mex.lyftbikes.com/gbfs/en/station_information.json')
                .then(response => response.json())
                .then(data => {
                    const stations = data.data.stations;
                    const names = stations.map(station => station.name);
                    const lon = stations.map(station => station.lon);
                    const lat = stations.map(station => station.lat);
                    return { stations, names, lon, lat };
                })
                .then(({ stations, names, lon, lat }) => {
                    return fetch('https://gbfs.mex.lyftbikes.com/gbfs/en/station_status.json')
                        .then(response => response.json())
                        .then(statusData => {
                            const stationsStatus = statusData.data.stations;
                            const geojsonEcoBicis = {
                                type: 'FeatureCollection',
                                features: stationsStatus.map((station, index) => ({
                                    type: 'Feature',
                                    properties: {
                                        id: station.station_id,
                                        name: names[index],
                                        numAvailable: station.num_bikes_available,
                                        numDisavailable: station.num_bikes_disabled,
                                        numDocksAvailable: station.num_docks_available,
                                        numDocksDisavailable: station.num_docks_disabled
                                    },
                                    geometry: {
                                        type: 'Point',
                                        coordinates: [lon[index], lat[index]],
                                    }
                                }))
                            };
            
                            // Move map-related code inside this block
                            map.addSource('ecobicis', {
                                type: 'geojson',
                                data: geojsonEcoBicis,
                            });
            
                            map.addLayer({
                                id: 'ecobicis-layer',
                                type: 'circle',
                                source: 'ecobicis',
                                paint: {
                                    'circle-radius': 8,
                                    'circle-stroke-width': 5,
                                    'circle-color': 'white',
                                    'circle-stroke-color': [
                                        'case',
                                        ['==', ['get', 'numAvailable'], 0], 'red', // If numAvailable is 0, set stroke color to red
                                        ['==', ['get', 'numAvailable'], 3], 'orange',
                                        'green' // Otherwise, set stroke color to green
                                    ]
                                }
                            });
                        });
                })
                .catch(error => {
                    console.error('Error:', error);
                });
            

        fetch('../../geojson/biciEstacionamiento/biciestacionamientos.json')
            .then(response => response.json())
            .then(data => {
                const biciestacionamientos = data.features;
        
                const geojsonBiciestacionamientos = {
                    type: 'FeatureCollection',
                    features: biciestacionamientos.map(biciestacionamiento => ({
                        type: 'Feature',
                        properties: {
                            sistema: biciestacionamiento.properties.SISTEMA,
                            nombre: biciestacionamiento.properties.NOMBRE,
                            ubicacion: biciestacionamiento.properties.UBICACION,
                            colonia: biciestacionamiento.properties.COLONIA,
                            alcaldia: biciestacionamiento.properties.ALCALDIA,
                            cp: biciestacionamiento.properties.CP,
                            capacidad: biciestacionamiento.properties.CAPACIDAD,
                            discapacidad: biciestacionamiento.properties.DISCAPACID,
                            operacion: biciestacionamiento.properties.OPERACION,
                        },
                        geometry: {
                            type: 'Point',
                            coordinates: biciestacionamiento.geometry.coordinates,
                        }
                    }))
                };
        
                map.addSource('biciestacionamientos', {
                    type: 'geojson',
                    data: geojsonBiciestacionamientos
                });
        
                map.addLayer({
                    id: 'biciestacionamientos-layer',
                    type: 'circle',
                    source: 'biciestacionamientos',
                    paint: {
                        'circle-radius': 8,
                        'circle-stroke-width': 2,
                        'circle-color': '#416633', 
                        'circle-stroke-color': 'white'
                    }
                });
            })
            .catch(error => console.error('Error fetching biciestacionamientos data:', error));

        fetch('../../geojson/puntoArribo/puntos-de-arribio-de-monopatines-elctricos-y-bicicletas.json')
            .then(response => response.json())
            .then(data => {
                const puntosArribo = data.features;
        
                const geojsonpuntosArribo = {
                    type: 'FeatureCollection',
                    features: puntosArribo.map(puntoArribo => ({
                        type: 'Feature',
                        properties: {
                            id: puntoArribo.properties.ID,
                            sistema: puntoArribo.properties.SISTEMA,
                            nombre: puntoArribo.properties.NOMBRE,
                            colonia: puntoArribo.properties.COLONIA,
                            alcaldia: puntoArribo.properties.ALCALDIA,
                        },
                        geometry: {
                            type: 'Point',
                            coordinates: puntoArribo.geometry.coordinates,
                        }
                    }))
                };
        
                map.addSource('puntosArribo', {
                    type: 'geojson',
                    data: geojsonpuntosArribo
                });
        
                map.addLayer({
                    id: 'puntosArribo-layer',
                    type: 'circle',
                    source: 'puntosArribo',
                    paint: {
                        'circle-radius': 8,
                        'circle-stroke-width': 2,
                        'circle-color': '#E64A00', 
                        'circle-stroke-color': 'white'
                    }
                });
            })
            .catch(error => console.error('Error fetching puntosArribo data:', error));
        
        fetch('../../geojson/cicloVias/infraestructura-vial-ciclista.json')
            .then(response => response.json())
            .then(data => {
                // Create a GeoJSON object with the fetched data
                const geojson = {
                type: 'FeatureCollection',
                features: data.features.map(feature => ({
                    type: 'Feature',
                    properties: feature.properties,
                    geometry: feature.geometry
                }))
                };
    
                // Add the GeoJSON as a source to the map
                map.addSource('route', {
                type: 'geojson',
                data: geojson
                });
    
                // Add a layer to display the route
                map.addLayer({
                id: 'cicloVias-layer',
                type: 'line',
                source: 'route',
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                paint: {
                    'line-color': '#303391',
                    'line-width': 10
                }
                });
            })
            .catch(error => console.error('Error fetching JSON:', error));

        // Fetch the JSON file
        fetch('../../geojson/vialidadesPrimarias/mapa-de-las-vialidades-primarias-de-la-ciudad-de-mxico-.json')
            .then(response => response.json())
            .then(data => {
                // Create a GeoJSON object with the fetched data
                const geojson = {
                type: 'FeatureCollection',
                features: data.features.map(feature => ({
                    type: 'Feature',
                    properties: feature.properties,
                    geometry: feature.geometry
                }))
                };

                // Add the GeoJSON as a source to the map
                map.addSource('vialidadesPrimarias', {
                type: 'geojson',
                data: geojson
                });

            // Add a layer to display the route
            map.addLayer({
            id: 'vialidadesPrimarias-layer',
            type: 'line',
            source: 'vialidadesPrimarias',
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': '#416633',
                'line-width': 2
            }
            });
        })
        .catch(error => console.error('Error fetching JSON:', error));




        // Center the map on the coordinates of any clicked circle from the 'circle' layer.
        map.on('click', 'ecobicis-layer', (e) => {
            const coordinates = e.features[0].geometry.coordinates.slice();
            const name = e.features[0].properties.name;
            const numAvailable = e.features[0].properties.numAvailable;

            console.log(e.features[0].properties);
            while(Math.abs(e.lngLat.lng - coordinates[0]) > 180 ){
                coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
            }

            const popup = new mapboxgl.Popup()
                .setLngLat(coordinates)
                .setHTML(`${name} \n Disponibles: ${numAvailable}`)
                .addTo(map);

            map.flyTo({
                center: e.features[0].geometry.coordinates
            });
        });

        // Change the cursor to a pointer when the it enters a feature in the 'circle' layer.
        map.on('mouseenter', 'ecobicis-layer', () => {
            map.getCanvas().style.cursor = 'pointer';
        });

        // Change it back to a pointer when it leaves.
        map.on('mouseleave', 'ecobicis-layer', () => {
            map.getCanvas().style.cursor = '';
        });

        // Center the map on the coordinates of any clicked circle from the 'circle' layer.
        map.on('click', 'biciestacionamientos-layer', (e) => {
            const coordinates = e.features[0].geometry.coordinates.slice();
            const name = e.features[0].properties.nombre;
            while(Math.abs(e.lngLat.lng - coordinates[0]) > 180 ){
                coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
            }

            const popup = new mapboxgl.Popup()
                .setLngLat(coordinates)
                .setHTML(`BiciEstacionamiento: ${name}`)
                .addTo(map);
            
            popup.getElement().style.backgroundColor = 'green';

            map.flyTo({
                center: e.features[0].geometry.coordinates
            });
        });

        // Change the cursor to a pointer when the it enters a feature in the 'circle' layer.
        map.on('mouseenter', 'biciestacionamientos-layer', () => {
            map.getCanvas().style.cursor = 'pointer';
        });

        // Change it back to a pointer when it leaves.
        map.on('mouseleave', 'biciestacionamientos-layer', () => {
            map.getCanvas().style.cursor = '';
        });

        // Center the map on the coordinates of any clicked circle from the 'circle' layer.
        map.on('click', 'puntosArribo-layer', (e) => {
            const coordinates = e.features[0].geometry.coordinates.slice();
            const name = e.features[0].properties.nombre;
            while(Math.abs(e.lngLat.lng - coordinates[0]) > 180 ){
                coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
            }

            const popup = new mapboxgl.Popup()
            .setLngLat(coordinates)
            .setHTML(`Punto de Arribo: ${name}`)
            .addTo(map);
        
            popup.getElement().style.backgroundColor = 'orange';

            map.flyTo({
                center: e.features[0].geometry.coordinates
            });
        });

        // Change the cursor to a pointer when the it enters a feature in the 'circle' layer.
        map.on('mouseenter', 'puntosArribo-layer', () => {
            map.getCanvas().style.cursor = 'pointer';
        });

        // Change it back to a pointer when it leaves.
        map.on('mouseleave', 'puntosArribo-layer', () => {
            map.getCanvas().style.cursor = '';
        });

        // Center the map on the coordinates of any clicked circle from the 'circle' layer.
        map.on('click', 'layer-with-pulsing-dot', (e) => {
            const coordinates = e.features[0].geometry.coordinates.slice();
            const description = "¡Incidente reportado!";
            while(Math.abs(e.lngLat.lng - coordinates[0]) > 180 ){
                coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
            }

            const popup = new mapboxgl.Popup()
                .setLngLat(coordinates)
                .setHTML(description)
                .addTo(map);
            
            popup.getElement().style.backgroundColor = 'red';

            map.flyTo({
                center: e.features[0].geometry.coordinates
            });
        });

        // Change the cursor to a pointer when the it enters a feature in the 'circle' layer.
        map.on('mouseenter', 'layer-with-pulsing-dot', () => {
            map.getCanvas().style.cursor = 'pointer';
        });

        // Change it back to a pointer when it leaves.
        map.on('mouseleave', 'layer-with-pulsing-dot', () => {
            map.getCanvas().style.cursor = '';
        });

        document
            .getElementById('lightPreset')
            .addEventListener('change', function () {
                map.setConfigProperty('basemap', 'lightPreset', this.value);
            });
        

            document.querySelectorAll('.map-overlay-inner input[type="checkbox"]').forEach((checkbox) => {
                checkbox.addEventListener('change', function () {

                    map.setConfigProperty('basemap', this.id, this.checked);

                    const checkboxId = this.id;
        
                    // Check the checkbox state
                    const isChecked = this.checked;
        
                    // Handle different checkbox IDs
                    switch (checkboxId) {
                        case 'showCicloVias':
                            // Toggle the visibility of the 'cicloVias' layer based on the checkbox state
                            map.setLayoutProperty('cicloVias-layer', 'visibility', isChecked ? 'visible' : 'none');
                            break;

                        case 'showVialidadesPrimarias':
                            // Toggle the visibility of the 'cicloVias' layer based on the checkbox state
                            map.setLayoutProperty('vialidadesPrimarias-layer', 'visibility', isChecked ? 'visible' : 'none');
                            break;

                        case 'showEcobici':
                            map.setLayoutProperty('ecobici-layer', 'visibility', isChecked ? 'visible' : 'none')
                            break;

                        case 'showBiciEstacionamiento':
                            map.setLayoutProperty('biciestacionamientos-layer', 'visibility', isChecked ? 'visible' : 'none')
                            break;

                        case 'showPuntosDeArribo':
                            map.setLayoutProperty('puntosArribo-layer', 'visibility', isChecked ? 'visible' : 'none')
                            break;

                        case 'showIncidentes':
                            map.setLayoutProperty('layer-with-pulsing-dot', 'visibility', isChecked ? 'visible' : 'none')
                            break;
                        // Add more cases for other checkboxes if needed
        
                        default:
                            break;
                    }
                });
            });

    });
