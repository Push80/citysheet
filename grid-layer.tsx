// Grid.tsx

import React from 'react';
import {DeckGL, PathLayer} from 'deck.gl';

const Grid: React.FC = () => {
  // Define the grid size and paths
  const gridSize = 5;
  const paths: Array<any> = [];

  // Generate the grid paths
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const x = i * 10; // Adjust spacing
      const y = j * 10; // Adjust spacing

      // Create a square path for each grid cell
      paths.push([
        [x, y], 
        [x + 10, y], 
        [x + 10, y + 10], 
        [x, y + 10], 
        [x, y]  // Closing the square
      ]);
    }
  }

  // Create layers
  const layers = [
    new PathLayer({
      id: 'path-layer',
      data: paths.map((path) => ({
        path,
        color: [255, 0, 0], // Color of the path
        width: 2
      })),
      getPath: d => d.path,
      getColor: d => d.color,
      getWidth: d => d.width,
      widthMinPixels: 2,
      pickable: true
    })
  ];

  // Set initial view state
  const initialViewState = {
    longitude: 0,
    latitude: 0,
    zoom: 2,
    pitch: 0,
    bearing: 0
  };

  return (
    <DeckGL
      initialViewState={initialViewState}
      controller={true}
      layers={layers}
      style={{position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', backgroundColor: '#f0f0f0'}}
    />
  );
};

export default Grid;
