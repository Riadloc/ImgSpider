'use strict'
let fs = require("fs");
let cheerio = require("cheerio");
let asyncQuene = require("async").queue;
let request = require("superagent");

const config = {
  startPage: 1,
  endPage: 1,
  downloadImg: true,
  downloadConcurrent: 10,
  name: 'baoru',
  imgType: "https://www.meitulu.com/t/baoru/",
  host: "https://www.meitulu.com"
};

let getHtmlAsync = function (url) {
  return new Promise(function (resolve, reject) {
    request.get(url).end(function (err, res) {
      // console.log(res);
      err ? reject(err) : resolve(cheerio.load(res.text));
    });
  });
};

let getAlbumAsync = function () {
  return new Promise(function (resolve, reject) {
    console.log("start get albums ......");
    let albums = [];
    let quene = asyncQuene(async function (url, callback) {
      try {
        let $ = await getHtmlAsync(url);
        console.log(`download ${url} success!`);
        $('.boxs .img li').each(function (index, item) {
          // console.log($(this).children().first());
          let slice = $(this).children().last().children('a').text().indexOf(']') + 1;
          albums.push({
            title: $(this).children().last().children('a').text().slice(slice),
            url: config.host + $(this).children().first()[0].attribs.href,
            imgList: []
          });
        });
      } catch (err) {
        console.log(`Error : get Album list - download ${url} err : ${err}`);
      } finally {
        callback();
      }
    }, 10);

    quene.drain = function () {
      console.log("get albums list complete");
      resolve(albums);
    }
    quene.push(config.imgType);
  });
}

let getImgListAsync = function (albumsList) {
  return new Promise(function (resolve, reject) {
    console.log("start get alums images ....");
    let quene = asyncQuene(async function ({ url: albumUrl, title: albumTitle, imgList }, callback) {
      try {
        let $ = await getHtmlAsync(albumUrl);
        console.log(`get album ${albumTitle} image done`);
        $('.content_img').each(function (index, item) {
          imgList.push(item.attribs.src);
        });
      } catch (err) {
        console.log(`Error :get image list - download ${albumUrl} err : ${err}`);
      } finally {
        callback(); 
      }
  }, 10);

  quene.drain = function () {
    console.log("get images list complete");
    resolve(albumsList);
  }

  quene.push(albumsList);
  });
}

function writeJsonToFile(albums) {
  const folder = `json-${config.name}`;
  fs.access(folder,(err) => {
    if (err) {
      fs.mkdir(folder);
    } else {
      return;
    }
  });
  let filePath = `./${folder}/${config.name}.json`;
  fs.writeFileSync(filePath, JSON.stringify(albums));

  let simpleAlbums = [];
  const slice = "https://www.meitulu.com".length + 1;
  albums.forEach(function ({ title: albumTitle, url: albumUrl, imgList }) {
    let temp = [];
    imgList.forEach(function (url) {
      temp.push(url.slice(slice));
    });
    simpleAlbums.push({ title: albumTitle, url: albumUrl, temp });
  }, this);
  filePath = `./${folder}/${config.name}.min.json`;
  fs.writeFileSync(filePath, JSON.stringify(simpleAlbums));
}

function downloadImg(albums) {
  console.log("start download images ....");
  const folder = `img-${config.name}`;
  fs.access(folder,(err) => {
    if (err) {
      fs.mkdir(folder);
    } else {
      return;
    }
  });
  let count = 0;
  let quene = asyncQuene(async function ({ title: albumTitle, url: imgUrl}, callback) {
    // console.log(imgUrl);
    request.get(imgUrl).end(function (err, res) {
      if (err) {
        console.log(err);
      } else {
        fs.writeFile(`./${folder}/${albumTitle}-${++count}.jpg`, res.body, function (err) {
          err ? console.log(err) : console.log(`save ${count} image`);
        })
      }
    })
    callback();
  }, config.downloadConcurrent);

  quene.drain = function () {
    console.log("all images have downloaded");
  }

  let tempImgList = [];
  albums.forEach(function ({ title, imgList }) {
    imgList.forEach(function (url) {
      tempImgList.push({ title: title, url: url });
    })
  });
  // console.log(imgList);
  quene.push(tempImgList);
}

async function spiderRun() {
  console.log("begin");
  let albums = await getAlbumAsync();
  albums = await getImgListAsync(albums);
  writeJsonToFile(albums);
  downloadImg(albums);
}

spiderRun();