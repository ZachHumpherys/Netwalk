"use strict";

class Board {
    static cellSize = 81;
    static directions = [
        { dx: 0, dy: -1 },
        { dx: 1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
    ];
    static edgeCounts = [1, 2, 2, 3];

    constructor(rows, columns, generate = true) {
        this.rows = rows;
        this.columns = columns;

        this.totalCells = this.rows * this.columns;

        if (generate) this.generate();
    }

    initializeEdges(v) {
        this.edges = [];
        for (let x = 0; x < this.columns; x++) {
            this.edges[x] = [];
            for (let y = 0; y < this.rows; y++) {
                this.edges[x][y] = [v, v, v, v];
            }
        }
    }

    generate() {
        this.initializeEdges(-1);

        const setEdgePair = (function(cell, direction, neighbor, value) {
            this.edges[cell.x][cell.y][direction] = value;
            this.edges[neighbor.x][neighbor.y][(direction + 2) % 4] = value;
        }).bind(this);

        const hasFreeEdge = (function(cell) {
            return this.edges[cell.x][cell.y].includes(-1);
        }).bind(this);

        let currentCell = this.getRandomCell();
        const visited = new Set([this.getCellKey(currentCell)]);

        while (visited.size < this.totalCells) {
            let crossFlag = false;

            const { direction, neighbor } = this.getRandomStep(currentCell);
            const neighborCellKey = this.getCellKey(neighbor);

            if (!visited.has(neighborCellKey)) {
                setEdgePair(currentCell, direction, neighbor, 1);
                
                crossFlag = !hasFreeEdge(currentCell);

                if (!crossFlag) visited.add(neighborCellKey);
                
                else setEdgePair(currentCell, direction, neighbor, -1);
            }

            if (!crossFlag) currentCell = neighbor;
        }
    }

    getNeighbor(cell, direction) {
        return {
            x: (cell.x + Board.directions[direction].dx + this.columns) % this.columns,
            y: (cell.y + Board.directions[direction].dy + this.rows) % this.rows,
        };
    }

    getRandomCell() {
        return { x: Math.floor(Math.random() * this.columns), y: Math.floor(Math.random() * this.rows) };
    }

    getRandomStep(cell) {
        const direction = Math.floor(Math.random() * 4);
        const neighbor = this.getNeighbor(cell, direction);
        return { direction, neighbor };
    }

    getCellKey(cell) {
        return cell.x + " " + cell.y;
    }

    getCellFromKey(key) {
        const [x, y] = key.split(" ");
        return { x: Number(x), y: Number(y) };
    }

    getPieceType(cell) {
        let type = 0, edges = this.edges[cell.x][cell.y];
        for (let i = edges.indexOf(1) + 1; i < edges.length; i++) {
            if (edges[i] > 0) type += 1 + (i > 1 && edges[i - 2] > 0);
        }
        return type;
    }

    getPieceTypes() {
        this.pieces = [];
        for (let x = 0; x < this.columns; x++) {
            this.pieces[x] = [];
            for (let y = 0; y < this.rows; y++) {
                this.pieces[x][y] = this.getPieceType({ x, y });
            }
        }
    }

    getCellImage(cell) {
        let string = "images/";
        for (let e = 0; e < 4; e++) {
            const value = this.edges[cell.x][cell.y][e];
            string += value > 0 ? "1" : value < 0 ? "0" : "x";
        }
        return string + ".png";
    }

    updateCellImage(cell) {
        document.getElementById(this.getCellKey(cell)).src = this.getCellImage(cell);
    }

    handleCellImageClick(event) {
        const cell = event.target.cell;
        this.rotate(cell);
        this.updateCellImage(cell);
    }

    rotate(cell, clockwise = true) {
        const edges = this.edges[cell.x][cell.y];
        if (clockwise) edges.unshift(edges.pop());
        else edges.push(edges.shift());
    }

    scramble() {
        for (let x = 0; x < this.columns; x++) {
            for (let y = 0; y < this.rows; y++) {
                const r = Math.floor(Math.random() * 4);
                for (let count = 0; count < r; count++) {
                    this.rotate({ x, y });
                }
            }
        }
    }

    render() {  
        let grid = document.getElementById('grid'); 

        if (!grid) grid = document.createElement('div');

        grid.id = 'grid';

        grid.style.width = Board.cellSize * this.columns + "px";
        grid.style.height = Board.cellSize * this.rows + "px";

        document.body.append(grid);

        const boundHandleCellImageClick = this.handleCellImageClick.bind(this);

        for (let x = 0; x < this.columns; x++) {
            for (let y = 0; y < this.rows; y++) {
                const cell = { x, y };

                const img = document.createElement('img');

                img.style.position = 'absolute';

                img.style.left = cell.x * Board.cellSize + "px";
                img.style.top = cell.y * Board.cellSize + "px";

                img.style.width = Board.cellSize + "px";
                img.style.height = Board.cellSize + "px";

                img.cell = cell;

                img.src = this.getCellImage(img.cell);
                img.id = this.getCellKey(img.cell);

                img.onclick = boundHandleCellImageClick;

                grid.append(img);
            }
        }
    }

}

class Group{
    constructor() {
        this.inner = new Set();
        this.outer = new Set();

        this.type = 0;

        this.zeros = 0;
        this.threes = 0;
    }
}

class Solver extends Board {
    constructor(board) {
        super(board.rows, board.columns, false);
        this.board = board;

        if (!board.pieces) board.getPieceTypes();

        this.edges = board.edges;
        this.pieces = board.pieces;
    }

    initializeBindings() {
        this.bindings = [];
        for (let x = 0; x < this.columns; x++) {
            this.bindings[x] = [];
            for (let y = 0; y < this.rows; y++) {
                this.bindings[x][y] = [null, null, null, null];
            }
        }

        this.bindEdges();

        this.getGroupsBySize();
    }

    getGroupsBySize() {
        this.groupsBySize = this.groups.map((group, index) => index);
        this.groupsBySize.sort((a, b) => this.groups[b].inner.size + this.groups[b].outer.size - this.groups[a].inner.size - this.groups[a].outer.size);
    }

    bindEdges() {
        const bindEdge = (function(cell, edge, group, subGroup) {
            const tryBindEdge = (function(cell, edge, group, subGroup) {
                if (!this.bindings[cell.x][cell.y][edge]) bindEdge(cell, edge, group, subGroup);
            }).bind(this);

            const tryBindEdgePair = (function(edge, subGroup) {
                this.bindings[cell.x][cell.y][edge] = { group, subGroup };
                tryBindEdge(this.getNeighbor(cell, edge), (edge + 2) % 4, group, subGroup);
            }).bind(this);
    
            tryBindEdgePair(edge, subGroup);
    
            const oppositeEdge = (edge + 2) % 4;
            const pieceType = this.pieces[cell.x][cell.y];
    
            if (pieceType === 1) {
                this.groups[group].inner.add(this.getCellKey(cell)); 
    
                tryBindEdgePair(oppositeEdge, -subGroup);
            }
            else if (pieceType === 2) {
                this.groups[group].inner.add(this.getCellKey(cell));
    
                tryBindEdgePair(oppositeEdge, subGroup);
                for (let i = 1; i < 4; i += 2) tryBindEdgePair((edge + i) % 4, -subGroup);
            }
            else {
                this.groups[group].outer.add(this.getCellKey(cell));
    
                this.groups[group][pieceType === 0 ? 'zeros' : 'threes']++;
            }
        }).bind(this);

        this.groups = [];

        for (let x = 0; x < this.columns; x++) {
            for (let y = 0; y < this.rows; y++) {
                for (let edge = 0; edge < 4; edge++) {
                    if (!this.bindings[x][y][edge]) {
                        this.groups.push(new Group());
                        bindEdge({ x, y }, edge, this.groups.length - 1, 1);
                    }
                }
            }
        }
    }

    getEdgeValue(cell, edge) {
        const { group, subGroup } = this.bindings[cell.x][cell.y][edge];
        return this.groups[group].type * subGroup;
    }

    getSignCounts(cell) {
        let positives = 0, negatives = 0;
        for (let edge = 0; edge < 4; edge++) {
            const value = this.getEdgeValue(cell, edge);

            if (value > 0) positives++;
            else if (value < 0) negatives++;
        }
        return { positives, negatives };
    }

    examine(cell) {
        const { positives, negatives } = this.getSignCounts(cell);
        const edgeCount = Board.edgeCounts[this.pieces[cell.x][cell.y]];

        if (positives > edgeCount || negatives > 4 - edgeCount) return false;

        const positivesFlag = positives === edgeCount;
        const negativesFlag = negatives === 4 - edgeCount;

        if (positivesFlag && negativesFlag) return true;

        return positivesFlag ? -1 : negativesFlag ? 1 : 0;
    }

    mergeInto(givingSet, receivingSet) {
        for (let element of givingSet) if (!receivingSet.has(element)) receivingSet.add(element);
    }

    explore(horizon, changes) {
        const explore = (function(cellKey) {
            const cell = this.getCellFromKey(cellKey);
            const result = this.examine(cell);

            if (result === false) return false;

            else if (result === 0) horizon.add(cellKey);

            else {
                horizon.delete(cellKey);

                if (result !== true) {
                    for (let edge = 0; edge < 4; edge++) {
                        if (this.getEdgeValue(cell, edge) === 0) {
                            const { group, subGroup } = this.bindings[cell.x][cell.y][edge];
                            const type = subGroup * result;
        
                            this.groups[group].type = type;
        
                            changes.push({ group, type });
        
                            if (!exploreAll(this.groups[group].outer)) return false;
                        }
                    }
                }
            }

            return true;
        }).bind(this);

        const exploreAll = (function(horizon) {
            for (const cellKey of horizon) if (!explore(cellKey)) return false;
            return true;
        }).bind(this);

        const valid = exploreAll(horizon);

        return { valid, changes, horizon };
    }

    revert(changes) {
        for (const change of changes) this.groups[change.group].type = 0;
    }

    assume(group, type) {
        this.groups[group].type = type;

        const result = this.explore(new Set(this.groups[group].outer), [{ group, type }]);

        result.valid = result.valid && this.validate(result.changes);

        return result;
    }

    validate(changes) {
        const exploreFrom = (function(cell) {
            const visited = new Set([this.getCellKey(cell)]);
            let wayOut = false;

            const explore = (function(cell, direction) {
                for (let d = 0; d < 4; d++) {
                    if (d !== direction) {
                        const edgeValue = this.getEdgeValue(cell, d);

                        if (edgeValue === 0) wayOut = true;

                        else if (edgeValue === 1) {
                            const neighbor = this.getNeighbor(cell, d);
                            const neighborKey = this.getCellKey(neighbor);

                            if (!visited.has(neighborKey)) {
                                visited.add(neighborKey);
                                
                                if (!explore(neighbor, (d + 2) % 4)) return false;
                            }

                            else return false;
                        }
                    }
                }
                return true;
            }).bind(this);

            const allValid = explore(cell) && (wayOut || visited.size === this.totalCells);

            if (allValid) for (const cellKey of visited) valid.add(cellKey);

            return allValid;
        }).bind(this);

        const validateSet = (function(set) {
            for (const cellKey of set) {
                if (!valid.has(cellKey)) {
                    const cell = this.getCellFromKey(cellKey);
                    if (!exploreFrom(cell)) return false;
                }
            }
            return true;
        }).bind(this);

        const valid = new Set();

        for (const change of changes) if (!validateSet(this.groups[change.group].inner) || !validateSet(this.groups[change.group].outer)) return false;

        return true;
    }

    apply(changes) {
        for (const change of changes) this.groups[change.group].type = change.type;
    }

    sweep(groups = this.getAllUnsetGroups()) {
       const sweep = (function(groups) {
            const conclude = (function(group) {
                const results = {};

                for (let i = 0, type = 1; i < 2; i++, type = -1) {
                    const result = this.assume(group, type);

                    results[String(type)] = result;

                    this.revert(result.changes);
                }

                const positiveResult = results["1"];
                const negativeResult = results["-1"];

                if (!positiveResult.valid && !negativeResult.valid) return false;

                const necessaryResult = positiveResult.valid ? negativeResult.valid ? null : positiveResult : negativeResult;

                if (necessaryResult) {
                    flag = true;

                    this.apply(necessaryResult.changes);

                    for (let change of necessaryResult.changes) changes.push(change);

                    this.mergeInto(necessaryResult.horizon, horizon);

                    return true;
                }
            }).bind(this);

            let flag = false;

            for (const group of groups) if (this.groups[group].type === 0 && conclude(group) === false) return false;
           
            return flag ? sweep(this.getUnsetGroups(horizon)) : true;
        }).bind(this);

        const horizon = new Set();
        const changes = [];

        return { valid: sweep(groups), changes, horizon };
    }

    getAllUnsetGroups() {
        const unset = [];
        for (let g = 0; g < this.groupsBySize.length; g++) {
            const nextLargest = this.groupsBySize[g];
            if (this.groups[nextLargest].type === 0) unset.push(nextLargest);
        }
        return unset;
    }

    getUnsetGroups(horizon) {
        const groups = new Set();
        for (const cellKey of horizon) {
            const cell = this.getCellFromKey(cellKey);
            for (let e = 0; e < 4; e++) {
                const group = this.bindings[cell.x][cell.y][e].group;
                if (this.groups[group].type === 0 && !groups.has(String(group))) groups.add(String(group));
            }
        }
        return groups;
    }

    getNextUnsetGroup() {
        for (let g = 0; g < this.groupsBySize.length; g++) {
            const nextLargest = this.groupsBySize[g];
            if (this.groups[nextLargest].type === 0) return nextLargest;
        }
    }

    getEdges() {
        this.edges = [];
        for (let x = 0; x < this.columns; x++) {
            this.edges[x] = [];
            for (let y = 0; y < this.rows; y++) {
                this.edges[x][y] = [];
                for (let e = 0; e < 4; e++) {
                    this.edges[x][y][e] = this.getEdgeValue({ x, y }, e);
                }
            }
        }
    }

    getSolution() {
        const solution = [];
        for (let g = 0; g < this.groups.length; g++) {
            solution.push(this.groups[g].type);
        }
        return solution;
    }

    loadSolution(solution, getEdges = false) {
        for (let g = 0; g < this.groups.length; g++) this.groups[g].type = solution[g];

        if (getEdges) this.getEdges();
    }

    solve(all = false) {
        const solve = (function() {
            const group = this.getNextUnsetGroup();

            if (group === undefined) {
                solutions.push(this.getSolution());

                if (!all) return true;
            }
            
            else {
                let type = all || this.groups[group].zeros > this.groups[group].threes ? 1 : -1;

                for (let i = 0; i < 2; i++, type *= -1) {
                    const result = this.assume(group, type);
                    let sweepResult;
                    
                    if (result.valid) {
                        sweepResult = this.sweep(this.getUnsetGroups(result.horizon));

                        if (sweepResult.valid && solve()) return true;
                    }

                    this.revert(result.changes);
                    if (sweepResult) this.revert(sweepResult.changes);
                }
            }
        }).bind(this);

        this.initializeBindings();

        this.sweep();

        const solutions = [];
        solve();
        return solutions;
    }
}

/**
 * 1. Creates a board (feel free to change the size) and a solver for it.
 * 2. Times how long the solver takes to solve the board (set the variable all to whether you want the solver to find all the solutions).
 * 3. Logs all found solutions and the combined time to find all of them to the console, and renders the first one.
 * 
 * Note: Expect some solves to be prohibitively long if trying to find all solutions for 35x35 boards or larger or one solution for 55x55 boards or larger.
 */

function test() {
    const board = new Board(35, 35);
    const solver = new Solver(board);

    let all = true;
        
    const beginSolve = performance.now();
    const solutions = solver.solve(all);
    const endSolve = performance.now();

    console.log(solutions, 'time to solve: ' + (endSolve - beginSolve));

    solver.loadSolution(solutions[0], true);
    solver.render();
}

test();
