
$(document).ready(function() {
  var reader;
  var progress = document.querySelector('.progress-bar');
  
  var tableBodyKCaII = $('#selectedPointsKCaII');
  var tableBodyGBand = $('#selectedPointsGBand');
  var tableBodyMgI = $('#selectedPointsMgI');

  var eqwInputKCaII = $('#eqw-KCaII');
  var eqwInputGBand = $('#eqw-GBand');
  var eqwInputMgI = $('#eqw-MgI');
  var eqwInputSum = $('#eqw-sum');

  var equationInputGyr = $('#equation-Gyr');
  var equationInputFeH = $('#equation-FeH');
  
  var wavelengthStartKCaII = 3908;
  var wavelengthEndKCaII = 3952;
  var wavelengthStartGBand = 4284;
  var wavelengthEndGBand = 4318;
  var wavelengthStartMgI = 5156;
  var wavelengthEndMgI = 5196;

  var pointsXKCaII = [];
  var pointsYKCaII = [];
  var pointsXGBand = [];
  var pointsYGBand = [];
  var pointsXMgI = [];
  var pointsYMgI = [];

  var eqwKCaII;
  var eqwGBand;
  var eqwMgI;
  var eqwSum;

  var equationGyr;
  var equationFeH;
  
  var wavelength, flux;

  function abortRead() {
    reader.abort();
  }

  function errorHandler(evt) {
    switch(evt.target.error.code) {
    case evt.target.error.NOT_FOUND_ERR:
      alert('File Not Found!');
      break;
    case evt.target.error.NOT_READABLE_ERR:
      alert('File is not readable');
      break;
    case evt.target.error.ABORT_ERR:
      break;
    default:
      alert('An error occurred reading this file.');
    };
  }

  function updateProgress(evt) {
    if (evt.lengthComputable) {
      var percentLoaded = Math.round((evt.loaded / evt.total) * 100);
      if (percentLoaded < 100) {
        progress.setAttribute('aria-valuenow', percentLoaded);
        progress.style.width = percentLoaded + '%';
        progress.textContent = percentLoaded + '%';
      }
    }
  }

  function parseMatrix(str) {
    return numeric.transpose(
      str.split('\n')
        .map(function(x) { return x.split(' ').map(parseFloat); })
    );
  }

  function clear() {
    tableBodyKCaII.empty();
    tableBodyGBand.empty();
    tableBodyMgI.empty();
    eqwInputKCaII.val('');
    eqwInputGBand.val('');
    eqwInputMgI.val('');
    eqwInputSum.val('');
    equationInputGyr.val('');
    equationInputFeH.val('');
    pointsXKCaII = [];
    pointsYKCaII = [];
    pointsXGBand = [];
    pointsYGBand = [];
    pointsXMgI = [];
    pointsYMgI = [];
  }

  function wavelengthRange(wavelength, flux, start, end) {
    var result_wl = [], result_fl = [];
    for (var i = 0; i < wavelength.length; i++) {
      var wl = wavelength[i], fl = flux[i];
      if (wl >= start && wl <= end) {
        result_wl.push(wl);
        result_fl.push(fl);
      }
    }
    return [result_wl, result_fl];
  }

  function diff(vector) {
    var result = [];
    for (var i = 0; i < vector.length - 1; i++)
      result.push(vector[i+1] - vector[i]);
    return result;
  }

  function calculateEQWBand(wavelength, flux, wavelengthStart, wavelengthEnd, selectedPointsX, selectedPointsY) {
    var result = wavelengthRange(
      wavelength, flux, wavelengthStart, wavelengthEnd);
    var wl_range = result[0];
    var flux_range = result[1];
    var xs = selectedPointsX.concat([wl_range[0], wl_range.slice(-1)[0]]);
    var ys = selectedPointsY.concat(flux_range[0], flux_range.slice(-1)[0]);
    var spline = numeric.spline(xs, ys);
    var spline_flux = spline.at(wl_range);
    var flux_result = numeric.div(flux_range, spline_flux);
    var X = numeric.sub(flux_result, 1);
    var D = diff(wl_range);
    var S = numeric.mul(X.slice(0, -1), D);
    var EQW = numeric.sum(S.map(Math.abs));
    return EQW;
  }

  function calculateEQW() {
    eqwKCaII = calculateEQWBand(wavelength, flux,
      wavelengthStartKCaII, wavelengthEndKCaII, pointsXKCaII, pointsYKCaII);

    console.log(eqwKCaII);

    eqwGBand = calculateEQWBand(wavelength, flux,
      wavelengthStartGBand, wavelengthEndGBand, pointsXGBand, pointsYGBand);

    console.log(eqwGBand);

    eqwMgI = calculateEQWBand(wavelength, flux,
      wavelengthStartMgI, wavelengthEndMgI, pointsXMgI, pointsYMgI);

    console.log(eqwMgI);

    eqwSum = eqwKCaII + eqwGBand + eqwMgI;
  }

  function outputEQW() {
    eqwInputKCaII.val(eqwKCaII);
    eqwInputGBand.val(eqwGBand);
    eqwInputMgI.val(eqwMgI);
    eqwInputSum.val(eqwSum);
  }

  function tableAppendPoint(x, y) {
    var selectedPointsX;
    var selectedPointsY;
    var tableBody;

    if (x >= wavelengthStartKCaII && x <= wavelengthEndKCaII) {
      selectedPointsX = pointsXKCaII;
      selectedPointsY = pointsYKCaII;
      tableBody = tableBodyKCaII;
    }
    else if (x >= wavelengthStartGBand && x <= wavelengthEndGBand) {
      selectedPointsX = pointsXGBand;
      selectedPointsY = pointsYGBand;
      tableBody = tableBodyGBand;
    }
    else if (x >= wavelengthStartMgI && x <= wavelengthEndMgI) {
      selectedPointsX = pointsXMgI;
      selectedPointsY = pointsYMgI;
      tableBody = tableBodyMgI;
    }
    else {
      alert("Please select points within the range of the bands");
      return;
    }

    selectedPointsX.push(x);
    selectedPointsY.push(y);
    var tr = $('<tr>');
    tr.append($('<td>').append(x));
    tr.append($('<td>').append(y));
    tableBody.append(tr);
  }

  function splinePoints(xs, ys) {
    var factor = 2;
    var sp = numeric.spline(xs, ys);
    var xs_start = xs[0];
    var xs_end = xs[xs.length - 1];
    var xs_diff = xs_end - xs_start;
    var sp_xs = numeric.linspace(xs_start, xs_end, xs_diff*factor + 1,
                                 'periodic');
    var sp_ys = sp.at(sp_xs);
    return [sp_xs, sp_ys];
  }

  function plotData(xs, ys) {
    var values = [];
    var sp = splinePoints(xs, ys);
    var sp_xs = sp[0];
    var sp_ys = sp[1];
    for (var i = 0; i < sp_xs.length; i++) {
      values.push({x: sp_xs[i], y: sp_ys[i]});
    }
    var datum = [{values: values, key: 'Flux', color: '#ff7f0e'}];

    nv.addGraph(function() {
      var width = nv.utils.windowSize().width - 40;
      var height = nv.utils.windowSize().height - 40;

      var chart = nv.models.lineWithFocusChart()
            .height(height)
            .transitionDuration(250)
            .showLegend(true);

      chart.xAxis
        .axisLabel('Wavelength (Angstroms)')
        .tickFormat(d3.format('.02f'));

      chart.yAxis
        .axisLabel('Flux')
        .tickFormat(d3.format('.02f'));

      d3.select('#plot svg')
        .attr('height', height)
        .datum(datum)
        .call(chart);

      nv.utils.windowResize(chart.update);
      chart.lines.dispatch.on('elementClick', function(e) {
        tableAppendPoint(e.point.x, e.point.y);
      });

      return chart;
    });
  }

  function handleFileSelect(evt) {
    progress.setAttribute('aria-valuenow', '0');
    progress.style.width = '0%';
    progress.textContent = '0%';

    reader = new FileReader();
    reader.onerror = errorHandler;
    reader.onprogress = updateProgress;
    reader.onabort = function(e) {
      alert('File read cancelled');
    };
    reader.onload = function(e) {
      progress.setAttribute('aria-valuenow', '100');
      progress.style.width = '100%';
      progress.textContent = '100%';
      var matrix = parseMatrix(reader.result);
      wavelength = matrix[0].slice(0, -1);
      flux = matrix[1].slice(0, -1);
      plotData(wavelength, flux);
    };

    var file = evt.target.files[0];
    reader.readAsText(file);
  }

  function calculateEquation(a, b, c, eqwm) {
    return a + b*eqwm + c*eqwm*eqwm;
  }

  function calculateEquations() {
    equationGyr = calculateEquation(-2.18, 0.188, -0.003, eqwSum);
    equationFeH = calculateEquation(-2.9, 0.14, -0.0023, eqwSum);
  }

  function outputEquations() {
    equationInputGyr.val(equationGyr);
    equationInputFeH.val(equationFeH);
  }

  function calculateAll() {
    calculateEQW();
    outputEQW();
    calculateEquations();
    outputEquations();
  }

  $('#files').change(function(event) {
    handleFileSelect(event);
  });
  $('#clearButton').click(function(event) {
    clear();
  });
  $('#calculateEQWButton').click(function(event) {
    calculateAll();
  });
});
