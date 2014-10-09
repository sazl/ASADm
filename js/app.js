
$(document).ready(function() {
  var reader;
  var progress = document.querySelector('.progress-bar');
  var tableBody = $('#selectedPointsBody');
  var eqwInput = $('#eqw');
  var wavelengthStartInput = $('#wavelengthStartInput');
  var wavelengthEndInput = $('#wavelengthEndInput');

  var selectedPointsX = [];
  var selectedPointsY = [];
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
      break; // noop
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
    tableBody.empty();
    selectedPointsX = [];
    selectedPointsY = [];
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

  function calculateEQW() {
    var wavelengthStart = parseFloat(wavelengthStartInput.val());
    var wavelengthEnd = parseFloat(wavelengthEndInput.val());
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
    eqwInput.val(EQW);
  }

  function tableAppendPoint(x, y) {
    selectedPointsX.push(x);
    selectedPointsY.push(y);
    var tr = $('<tr>');
    tr.append($('<td>').append(x));
    tr.append($('<td>').append(y));
    tableBody.append(tr);
  }

  function splinePoints(xs, ys) {
    var sp = numeric.spline(xs, ys);
    var xs_start = xs[0];
    var xs_end = xs[xs.length - 1];
    var xs_diff = xs_end - xs_start;
    var sp_xs = numeric.linspace(xs_start, xs_end, xs_diff*5 + 1, 'periodic');
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


  $('#files').change(function(event) {
    handleFileSelect(event);
  });
  $('#clearButton').click(function(event) {
    clear();
  });
  $('#calculateEQWButton').click(function(event) {
    calculateEQW();
  });
});
