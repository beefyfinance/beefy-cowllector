const objFromArray = (array, key) => {
  let obj = {};

  array.forEach(item => {
    if (!obj.hasOwnProperty(item[key])) {
      obj[item[key]] = [];
    }

    obj[item[key]].push(item);
  });

  return obj;
};

module.exports = objFromArray;
