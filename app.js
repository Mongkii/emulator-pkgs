import express from 'express';
import { Leapcell } from '@leapcell/leapcell-js';
import axios from 'axios';
import { load } from 'cheerio';
import 'dotenv/config';

const semanticVerSort = (majorA, minorA, patchA, majorB, minorB, patchB) => {
  if (majorA !== majorB) {
    return majorA - majorB;
  }
  if (minorA !== minorB) {
    return minorA - minorB;
  }
  return patchA - patchB;
};

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
    sorter: (a, b) => {
      const [majorA, minorA, patchA] = a.split('.').map(Number);
      const [majorB, minorB, patchB] = b.split('.').map(Number);

      return semanticVerSort(majorA, minorA, patchA, majorB, minorB, patchB);
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
    sorter: (a, b) => {
      const patchA = Number(a.split('-')[1]);
      const [majorA, minorA] = a.split('-')[0].split('.').map(Number);

      const patchB = Number(b.split('-')[1]);
      const [majorB, minorB] = b.split('-')[0].split('.').map(Number);

      return semanticVerSort(majorA, minorA, patchA, majorB, minorB, patchB);
    },
  },
];

const app = express();

const api = new Leapcell({
  apiKey: process.env.LEAPCELL_API_KEY,
});
const repo = process.env.RESOURCE;
const tableId = process.env.TABLE_ID;

const table = api.repo(repo).table(tableId);

app.get('/update-list', async (request, response) => {
  for (let i = 0, len = configs.length; i < len; i++) {
    const { url, parse, sorter, emulator } = configs[i];

    const pageResp = await axios.get(url);
    const result = parse(load(pageResp.data));
    result.sort((a, b) => sorter(a.version, b.version));

    await table.records.deleteMany({ where: { Emulator: { eq: emulator } } });
    await table.records.createMany(
      result.map(({ version, url }, i) => ({
        Version: version,
        Emulator: emulator,
        URL: url,
        index: i,
      }))
    );
  }

  response.send('OK');
});

const renderList = (emulator, packages) =>
  `
<h1>${emulator}</h1>
<ul>
  ${packages.map(({ url, version }) => `<li><a href="${url}">${version}</a></li>`).join('')}
</ul>
`.trim();

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

  const records = await table.records.findMany({
    where: { Emulator: { eq: emulator } },
    orderBy: { index: 'desc' },
  });
  const packages = records.map((record) => ({
    url: record.fields['URL'],
    version: record.fields['Version'],
  }));

  return response.send(renderList(emulator, packages));
});

app.listen(8080, () => {
  console.log('App is listening on port 8080');
});
