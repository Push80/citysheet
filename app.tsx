import React from 'react';
import DeckGL from '@deck.gl/react';
import {createRoot} from 'react-dom/client';
import {COORDINATE_SYSTEM, Deck, PickingInfo, OrbitView} from '@deck.gl/core';
import {PathLayer, ArcLayer, TextLayer} from '@deck.gl/layers';

type Coordinate = [number, number];
interface PathObject {
  path: Coordinate[];
}


type GridLine = {
  path: Coordinate;
};

type Cell = {
  coords: Coordinate;
  weight: number;
  value: string;
  font: string;
  font_size: number;
  color: string;
  background_color: string;
}


type BartSegment = {
  inbound: number;
  outbound: number;
  from: {
    name: string;
    coordinate: [longitude: number, latitude: number];
  };
  to: {
    name: string;
    coordinate: [longitude: number, latitude: number];
  };
};

export default function App() {
  // Define the path to the JSON file
  const filePath = "/sheet_info.json"
  console.log(filePath)
  var row_layer = new PathLayer<GridLine>
  var col_layer = new PathLayer<GridLine>
  var cell_layer = new TextLayer<Cell>
  // Read the JSON file and parse it
  fetch(filePath)
      .then(response => response.json())
      .then(data => {
          const rows: PathObject[] = data.sheet?.rows;
          const cols: PathObject[] = data.sheet?.cols;
          const cells = data.sheet?.cells;
          if (Array.isArray(rows) && Array.isArray(cols)) {
            row_layer = draw_lines(rows, "RowPaths");
            col_layer = draw_lines(cols, "ColPaths");
            cell_layer = draw_cells(cells)

            new Deck({
              initialViewState: {
                target: [0, 0, 0],  // Center the view on (0,0) in Cartesian space
                zoom: 0.2,
                rotationX: 90,
                rotationOrbit: 0
              },
              controller: {
                dragMode: 'pan' // Invert controls: regular drag pans, Ctrl+drag rotates
              },
              views: new OrbitView(),
              layers: [row_layer, col_layer]
            });
          }
      })
      .catch(error => console.error("Error fetching JSON:", error));

  function draw_lines(coords: PathObject[], id: string): PathLayer<GridLine> {
    //This is currently drawing the grid using an array of coordinates
    const path_layer = new PathLayer<GridLine>({
      id: id,
      data: coords,
      getPath: (d: GridLine) => d.path,
      getWidth: 1,
      pickable: true,
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN
    });
    console.log(path_layer)
    return path_layer;
  }

  function draw_cells(cells): TextLayer<Cell> {
    const text_layer = new TextLayer<Cell>({
      id: "CellLayer",
      data: cells,

      background: true,
      billboard: false,
      getPosition: (d: Cell) => [d.coords[0], d.coords[1], d.weight * 100],
      getText: (d: Cell) => d.value,
      getBackgroundColor: (d: Cell) => {
        const hex = d.background_color;
        // convert to RGB
        return hex.match(/[0-9a-f]{2}/g).map(x => parseInt(x, 16));
      },
      getColor: (d: Cell) => {
        const hex = d.color;
        // convert to RGB
        return hex.match(/[0-9a-f]{2}/g).map(x => parseInt(x, 16));
      },
      sizeScale: 0.0001,
      sizeUnits: 'common',

    })
    return text_layer;
  }
}



export function renderToDOM(container: HTMLDivElement) {
  createRoot(container).render(<App />);
}


