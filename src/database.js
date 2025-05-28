import YAML from 'https://cdn.jsdelivr.net/npm/yaml@2/+esm';
import ky from 'https://cdn.jsdelivr.net/npm/ky@1/+esm';

function parseCSV(csv) {
  return csv.split('\n')
    .filter(line => line.trim())     // 空行を除去
    .map(line => line.split(','));   // カンマで分割
}

export default {
  loadDb: (async () => {
    const configYaml = YAML.parse(await ky.get('../config/config.yaml').text());
    const memberListCsv = parseCSV(await ky.get('../config/member_list.csv').text());
    const seatPositionMatrixCsv = parseCSV(await ky.get('../config/seat_position_matrix.csv').text());
    return {
      ...configYaml,
      MEMBER_LIST: memberListCsv.map(entry => ({ id: parseInt(entry[0]), name: entry[1], ruby: entry[2] })),
      SEAT_POSITION_MATRIX: seatPositionMatrixCsv.map(entry => entry.map(entry2 => parseInt(entry2))),
    }
  })
}
