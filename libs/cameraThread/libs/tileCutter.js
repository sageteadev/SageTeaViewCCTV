const SAT = require('sat')
const V = SAT.Vector;
const P = SAT.Polygon;
const B = SAT.Box;

function intersectionY(edge, y) {
    const [[x1, y1], [x2, y2]] = edge;
    const dir = Math.sign(y2 - y1);
    if (dir && (y1 - y)*(y2 - y) <= 0) return { x: x1 + (y-y1)/(y2-y1) * (x2-x1), dir };
}


function tilePolygon(points, tileSize){
    // https://stackoverflow.com/questions/56827208/spilliting-polygon-into-square
    const minY = Math.min(...points.map(p => p[1]));
    const maxY = Math.max(...points.map(p => p[1]));
    const minX = Math.min(...points.map(p => p[0]));
    const gridPoints = [];
    for (let y = minY; y <= maxY; y += tileSize) {
        // Collect x-coordinates where polygon crosses this horizontal line (y)
        const cuts = [];
        let prev = null;
        for (let i = 0; i < points.length; i++) {
            const cut = intersectionY([points[i], points[(i+1)%points.length]], y);
            if (!cut) continue;
            if (!prev || prev.dir !== cut.dir) cuts.push(cut);
            prev = cut;
        }
        if (prev && prev.dir === cuts[0].dir) cuts.pop();
        // Now go through those cuts from left to right toggling whether we are in/out the polygon
        let dirSum = 0;
        let startX = null;
        for (let cut of cuts.sort((a, b) => a.x - b.x)) {
            dirSum += cut.dir;
            if (dirSum % 2) { // Entering polygon
                if (startX === null) startX = cut.x;
            } else if (startX !== null) { // Exiting polygon
                // Genereate grid points on this horizontal line segement
                for (let x = minX + Math.ceil((startX - minX) / tileSize)*tileSize; x <= cut.x; x += tileSize) {
                    gridPoints.push([x, y]);
                }
                startX = null;
            }
        }
    }
    return gridPoints;
}

function convertStringPoints(oldPoints){
    // [["0","0"],["0","150"],["300","150"],["300","0"]]
    var newPoints = []
    oldPoints.forEach((point) => {
        newPoints.push([parseInt(point[0]),parseInt(point[1])])
    })
    return newPoints
}

function createSquares(gridPoints,imgWidth,imgHeight){
    var rows = [];
    var n = 0;
    var curentLine = gridPoints[0][1]
    gridPoints.forEach((point) => {
        if(!rows[n])rows[n] = []
        rows[n].push(point)
        if(curentLine !== point[1]){
            curentLine = point[1];
            ++n;
        }
    });
    var squares = [];
    rows.forEach((row,n) => {
        for (let i = 0; i < row.length; i += 2) {
            if(!rows[n + 1] || !row[i + 1])return;
            var square = [row[i],row[i + 1],rows[n + 1][i],rows[n + 1][i + 1]]
            squares.push(square)
        }
    })
    return squares
}
const getAllSquaresTouchingRegion = function(region,squares){
    var matrixPoints = []
    var collisions = []
    var polyPoints = []
    region.points.forEach(function(point){
        polyPoints.push(new V(parseInt(point[0]),parseInt(point[1])))
    })
    var regionPoly = new P(new V(0,0), polyPoints)
    squares.forEach(function(squarePoints){
        var firstPoint = squarePoints[0]
        var thirdPoint = squarePoints[2]
        var squareX = firstPoint[0]
        var squareY = firstPoint[1]
        var squareWidth = thirdPoint[0] - firstPoint[0]
        var squareHeight = thirdPoint[1] - firstPoint[1]
        var squarePoly = new B(new V(squareX, squareY), squareWidth, squareHeight).toPolygon()
        var response = new SAT.Response()
        var collided = SAT.testPolygonPolygon(squarePoly, regionPoly, response)
        if(collided === true){
            collisions.push(squarePoints)
        }
    })
    return collisions
}
function makeBigMatricesFromSmallOnes(matrices){
    var bigMatrices = {}
    matrices.forEach(function(matrix,n){
        const regionName = matrix.tag
        if(!bigMatrices[regionName]){
            bigMatrices[regionName] = {
                tag: regionName,
                x: 9999999999,
                y: 9999999999,
                width: matrices.length > 1 ? matrices[0].width : 0,
                height: matrices.length > 1 ? matrices[0].height : 0,
                tilesCounted: 0,
                confidence: 0,
            }
        }
        var bigMatrix = bigMatrices[regionName];
        bigMatrix.x = bigMatrix.x > matrix.x ? matrix.x : bigMatrix.x;
        bigMatrix.y = bigMatrix.y > matrix.y ? matrix.y : bigMatrix.y;
        const newWidth = matrix.x - bigMatrix.x
        const newHeight = matrix.y - bigMatrix.y
        bigMatrix.width = bigMatrix.width < matrix.x ? newWidth === 0 ? matrix.width : newWidth : bigMatrix.width;
        bigMatrix.height = bigMatrix.height < matrix.y ? newHeight === 0 ? matrix.height : newHeight : bigMatrix.height;
        // bigMatrix.tag = matrix.tag;
        bigMatrix.confidence += matrix.confidence;
        bigMatrix.tilesCounted += 1;
    })
    let allBigMatrices = Object.values(bigMatrices)
    allBigMatrices.forEach(function(matrix,n){
        let bigMatrix = allBigMatrices[n]
        bigMatrix.averageConfidence = bigMatrix.confidence / bigMatrix.tilesCounted;
    })
    return allBigMatrices
}
function convertRegionsToTiles(monitorDetails){
    let originalCords;
    //force full frame detection to be use for tracking blobs
    monitorDetails.detector_frame = '1'
    monitorDetails.detector_sensitivity = '1'
    monitorDetails.detector_color_threshold = monitorDetails.detector_color_threshold || '7'
    try{
        monitorDetails.cords = JSON.parse(monitorDetails.cords)
    }catch(err){

    }
    originalCords = Object.values(monitorDetails.cords)
    const regionKeys = Object.keys(monitorDetails.cords);
    const newRegionsBySquares = {}
    try{
        regionKeys.forEach(function(regionKey){
            const region = monitorDetails.cords[regionKey]
            const tileSize = parseInt(region.detector_tile_size) || 20;
            const gridPoints = tilePolygon([
                [0,0],
                [0,height],
                [width,height],
                [width,0]
            ],tileSize)
            const squares = createSquares(gridPoints,width,height)
            const squaresInRegion = getAllSquaresTouchingRegion(region,squares)
            squaresInRegion.forEach((square,n) => {
                newRegionsBySquares[`${regionKey}_${n}`] = Object.assign({},region,{
                   "points": square
                })
            })
        })
        // jsonData.rawMonitorConfig.details.cords = newRegionsBySquares;
    }catch(err){
        process.logData(err)
    }
    // detectorUtils.originalCords = originalCords;
    return {
        originalCords,
        newRegionsBySquares,
    }
}
module.exports = {
    tilePolygon,
    createSquares,
    convertRegionsToTiles,
    getAllSquaresTouchingRegion,
    makeBigMatricesFromSmallOnes,
}
