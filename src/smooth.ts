export function smooth(smoothingUp:number, smoothingDown:number):Function {
    let smoothedValues:number[] = null;
    return function smooth(newValues:number[]):number[] {
      if (smoothedValues === null)
        smoothedValues = newValues;
      else {
        smoothedValues = smoothedValues.map((smoothedVal, i) => {
          const newVal:number = newValues[i];
          const smoothing = newVal > smoothedVal ? smoothingUp : smoothingDown;
          return (1-smoothing) * newVal + smoothing*smoothedVal;
        })
        
      }
      return smoothedValues;
    }
  }

  export function normalize():Function {
    let maxValues:number[] = null;
    let minValues:number[] = null;
    return function normalize(newValues:number[]):number[] {
      if (maxValues === null) {
        maxValues  = newValues;
        minValues = newValues;
      }
      else {
        maxValues = maxValues.map((maxVal, i) => {
          const newVal:number = newValues[i];
          return Math.max(Math.max(newVal, maxVal),0.1);
        })
        minValues = minValues.map((minVal, i) => {
            const newVal:number = newValues[i];
            return Math.min(newVal, minVal);
          })

      }
      const normalizedValues = newValues
      .map((val,i) => (val-minValues[i])/(maxValues[i]-minValues[i]))
      .map(val => Number.isFinite(val) ? val : 0)
        return normalizedValues;
    }
  }

// export  smooth;


export function convolute(data, kernel, accessor){
	var kernel_center = Math.floor(kernel.length/2);
	var left_size = kernel_center;
	var right_size = kernel.length - (kernel_center-1);
	if(accessor == undefined){
		accessor = function(datum){
			return datum;
		}
	}

	function constrain(i,range){
		if(i<range[0]){
			i=0;
		}
		if(i>range[1]){
			i=range[1];
		}
		return i;
	}

	var convoluted_data = data.map(function(d,i){
		var s = 0;
		for(var k=0; k < kernel.length; k++){
			var index = constrain( ( i + (k-kernel_center) ), [0, data.length-1] ); 
			s += kernel[k] * accessor(data[index]);
		}
		return s;
	});


	return convoluted_data;
}



export function normaliseKernel(a){
	function arraySum(a){
		var s = 0;
		for (var i =0;i<a.length;i++){
			s += a[i];
		}
		return s;
	}

	var sum_a = arraySum(a);
	var scale_factor = sum_a / 1;
	a = a.map(function(d){
		return d / scale_factor;
	})
	return a;
}

const _ = require("underscore");

export function gaussSmoothList (list, degree:number) {
  var win = degree*2-1;
  let weight = _.range(0, win).map(function (x) { return 1.0; });
  const weightGauss = [];
  for (let i of _.range(0, win)) {
      const newi = i-degree+1;
      const frac = newi/win;
      const gauss = 1 / Math.exp((4*(frac))*(4*(frac)));
      weightGauss.push(gauss);
  }
  weight = _(weightGauss).zip(weight).map(function (x) { return x[0]*x[1]; });
  const smoothed = _.range(0, (list.length+1)-win).map(function (x) { return 0.0; });
  for (let i=0; i < smoothed.length; i++) {
      smoothed[i] = _(list.slice(i, i+win)).zip(weight).map(function (x) { return x[0]*x[1]; }).reduce(function (memo, num){ return memo + num; }, 0) / _(weight).reduce(function (memo, num){ return memo + num; }, 0);
  }
  return smoothed;
}