import express from 'express';
import { Leapcell } from '@leapcell/leapcell-js';
import axios from 'axios';
import { load } from 'cheerio';
import 'dotenv/config';

const configs = [
  {
    emulator: 'RetroArch',
    url: 'https://buildbot.libretro.com/stable',
    parse: ($) => {
      const regNum = /^\d+/;
      const versions = $('td.fb-n')
        .map((i, ele) => $(ele).text().trim())
        .toArray()
        .filter((item) => regNum.test(item));

      return versions.map((version) => ({
        url: `https://buildbot.libretro.com/stable/${version}/android/RetroArch_aarch64.apk`,
        version,
      }));
    },
  },
  {
    emulator: 'Dolphin',
    url: 'https://dolphin-emu.org/download/?nocr=true',
    parse: ($) => {
      const infoTrs = $('#download-beta table.versions-list.dev-versions tr.infos');

      return infoTrs
        .map((i, ele) => {
          const version = $(ele).find('td.version').text().trim();
          const url = $(ele).next().find('a.android').attr('href');
          return { url, version };
        })
        .toArray();
    },
  },
];

const app = express();
app.set('views', './templates');
app.set('view engine', 'ejs');

const api = new Leapcell({
  apiKey: process.env.LEAPCELL_API_KEY,
});
const repo = process.env.RESOURCE;
const tableId = process.env.TABLE_ID;

const table = api.repo(repo).table(tableId);

app.get('/update-list', async (request, response) => {
  for (let i = 0, len = configs.length; i < len; i++) {
    const { url, parse, emulator } = configs[i];

    const pageResp = await axios.get(url);
    const result = parse(load(pageResp.data));

    await table.records.deleteMany({ where: { Emulator: { eq: emulator } } });
    await table.records.createMany(
      result.map(({ version, url }) => ({ Version: version, Emulator: emulator, URL: url }))
    );
  }

  response.send('OK');
});

app.get('/list/:emulator', async (request, response) => {
  const rawEmulator = request.params.emulator;

  let emulator;
  if (rawEmulator === 'retroarch') {
    emulator = 'RetroArch';
  } else if (rawEmulator === 'dolphin') {
    emulator = 'Dolphin';
  } else {
    return response.status(400).send('Invalid emulator');
  }

  const records = await table.records.findMany({ where: { Emulator: { eq: emulator } } });
  const packages = records.map((record) => ({
    url: record.fields['URL'],
    version: record.fields['Version'],
  }));

  return response.render('packages', { emulator, packages });
});

app.listen(8080, () => {
  console.log('App is listening on port 8080');
});
