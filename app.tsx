import React, { useState, useCallback } from 'react';
import DeckGL from '@deck.gl/react';
import {createRoot} from 'react-dom/client';
import {COORDINATE_SYSTEM, Deck, PickingInfo, OrbitView} from '@deck.gl/core';
import {PathLayer, ArcLayer, TextLayer, ColumnLayer} from '@deck.gl/layers';

type Coordinate = [number, number];
interface PathObject {
  path: Coordinate[];
}


type GridLine = {
  path: Coordinate;
};

type Cell = {
  coord: Coordinate;
  weight: number;
  width: number;
  height: number;
  value: string;
  font: string;
  font_size: number;
  color: string;
  background_color: string;
}

type Connection = {
  from: {
      name: string;
      weight: number;
      coords: [number, number];
  };
  to: {
      name: string;
      weight: number;
      coords: [number, number];
  };
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

var DECK
var rows, cols, cells, row_layer, col_layer, cell_layer, tower_layer, arc_layer
const HIGHLIGHT_COLOR = [255, 0, 0, 255]

export default function App() {
  var hoveredId = ""
  // Define the path to the JSON file
  const filePath = "/sheet_info.json"
  console.log(filePath)
  row_layer = new PathLayer<GridLine>
  col_layer = new PathLayer<GridLine>
  cell_layer = new TextLayer<Cell>
  tower_layer = new ColumnLayer<Cell>
  arc_layer = new ArcLayer<Connection>
  // Read the JSON file and parse it
  fetch(filePath)
      .then(response => response.json())
      .then(data => {
          rows = data.sheet?.rows;
          cols = data.sheet?.cols;
          cells = data.sheet?.cells;
          if (Array.isArray(rows) && Array.isArray(cols)) {
            row_layer = draw_lines(rows, "RowPaths");
            col_layer = draw_lines(cols, "ColPaths");
            cell_layer = draw_cells(cells)
            tower_layer = draw_towers(cells)
            arc_layer = draw_arcs(cells)

            const layers = [row_layer, col_layer, cell_layer, tower_layer, arc_layer]
            DECK = new Deck({
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
              layers: [row_layer, col_layer, cell_layer, tower_layer, arc_layer],
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
    return path_layer;
  }

  function draw_cells(cells): TextLayer<Cell> {
    const text_layer = new TextLayer<Cell>({
      id: "CellLayer",
      data: cells,

      background: true,
      billboard: false,
      getPosition: (d: Cell) => [d.coord[0]+2, d.coord[1]-2, d.weight * 10 + 1],
      getText: (d: Cell) => d.value,
      /*
      getBackgroundColor: (d: Cell) => {
        const hex = d.background_color;
        // convert to RGB
        return hex.match(/[0-9a-f]{2}/g).map(x => parseInt(x, 16));
      },
      getColor: (d: Cell) => {
        const hex = d.color;
        // convert to RGB
        return hex.match(/[0-9a-f]{2}/g).map(x => parseInt(x, 16));
      },*/
      sizeScale: 0.25,
      sizeUnits: 'common',
      getAlignmentBaseline: 'top',
      getTextAnchor: 'start',

    })
    return text_layer;
  }


  function draw_towers(cells): ColumnLayer<Cell> {
    const tower_layer = new ColumnLayer<Cell>({
      id: "TowerLayer",
      data: cells,
      getElevation: (d: Cell) => d.weight * 10,
      getPosition: (d: Cell) => [d.coord[0] + 7, d.coord[1] - 7],/*{
        const center_x = d.coord[0] + (d.width / 2)
        const center_y = d.coord[1] - (d.height / 2)
        return [center_x, center_y]
      },*/
      getFillColor: d => d.weight === 0 ? [0, 0, 0, 0] : [48, 128, Math.sqrt(d.weight * 10) * 15, 255],

      radius: 10,
      diskResolution: 4, //4 sided towers
      extruded: true,
      angle: 45,
    })
    return tower_layer
  }
  function draw_arcs(cells): ArcLayer<Connection> {
    // Create a lookup dictionary for quick access by cell name
    const cellLookup: Record<string, Cell> = {};
    cells.forEach(cell => {
        cellLookup[cell.name] = cell;
    });

    const connection_data: Connection[] = [];
    // Iterate over each cell in the input data
    cells.forEach(cell => {
        const fromCell = cell;

        // For each cell in the "uses" array, create a new Connection object
        fromCell.used_by.forEach(usedCellName => {
            const toCell = cellLookup[usedCellName];
            if (toCell) { // Only proceed if the target cell is found
                const connection: Connection = {
                    from: {
                        name: fromCell.value,
                        weight: fromCell.weight,
                        coords: [fromCell.coord[0] + 5, fromCell.coord[1] - 5]
                    },
                    to: {
                        name: toCell.value,
                        weight: toCell.weight,
                        coords: [toCell.coord[0] + 5, toCell.coord[1] - 5]
                    }
                };
                connection_data.push(connection);
            }
        });
    });
    arc_layer = new ArcLayer<Connection>({
      id: 'ArcLayer',
      data: connection_data,
      getSourcePosition: (d: Connection) => [d.from.coords[0], d.from.coords[1], d.from.weight * 10],
      getTargetPosition: (d: Connection) => [d.to.coords[0], d.to.coords[1], d.to.weight * 10],
      getSourceColor: (d: Connection) =>
        [48, 128, Math.sqrt(d.from.weight * 10) * 15, (d.from.name === hoveredId ? 255 : 64)], // 64 = 0.25 opacity, 255 = 1.0 opacity
      getTargetColor: (d: Connection) =>
        [48, 128, Math.sqrt(d.to.weight * 10) * 15, (d.to.name === hoveredId ? 255 : 64)], // 64 = 0.25 opacity, 255 = 1.0 opacity
      getWidth: 10,
      pickable: true,
      getHeight: 0.31415,
      //autoHighlight: true,
      //highlightColor: [0, 0, 128, 255],
      
      onHover: info => {
        hoveredId = (info.object ? info.object.from.name : null)
        row_layer = draw_lines(rows, "RowPaths");
        col_layer = draw_lines(cols, "ColPaths");
        cell_layer = draw_cells(cells)
        tower_layer = draw_towers(cells)
        arc_layer = draw_arcs(cells)

        const layers = [row_layer, col_layer, cell_layer, tower_layer, arc_layer]
        DECK.setProps({layers})
      },
      updateTriggers: {
        getSourceColor: [hoveredId], // Only update when hoveredId changes
        getTargetColor: [hoveredId]  // Only update when hoveredId changes
      },
    });
    return arc_layer
  }
}





export function renderToDOM(container: HTMLDivElement) {
  createRoot(container).render(<App />);
}


