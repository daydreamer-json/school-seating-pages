// import * as mdui from 'https://cdn.jsdelivr.net/npm/mdui@2/mdui.esm.js';
// import ky from 'https://cdn.jsdelivr.net/npm/ky@1/+esm';
// import { DateTime } from 'https://cdn.jsdelivr.net/npm/luxon@3/+esm';
import YAML from 'https://cdn.jsdelivr.net/npm/yaml@2.8.0/+esm';
import configDbFunc from './database.js';

let configDb = null;

// mdui.setColorScheme('#0d6efd', document.querySelector('#mainContainer'));
function updateTheme() {
  var isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.setAttribute('data-bs-theme', isDarkMode ? 'dark' : 'light');
}
window.addEventListener('DOMContentLoaded', updateTheme);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateTheme);

let temporalState = {
  shuffledStudents: null,
  currentMemberIndex: 0,
};

/**
 * Shuffle an array using secure random numbers (Fisher-Yates algorithm)
 * @param array Arrays to shuffle
 * @returns New shuffled array
 */
function secureShuffle(array) {
  const newArray = [...array];
  const randomValues = new Uint32Array(newArray.length);
  window.crypto.getRandomValues(randomValues);
  for (let i = newArray.length - 1; i > 0; i--) {
    // Generate random number in the range from 0 to i
    const j = randomValues[i] % (i + 1);
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

/**
 * Calculate the number of available seats
 * @param layout Seat layout
 * @returns Number of available seats
 */
function countAvailableSeats(layout) {
  let count = 0;
  for (const row of layout) {
    for (const seat of row) {
      if (seat === 1) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Render seating chart
 * @param currentSeatLayout Seating layout before assignment (for display purposes)
 * @param assignedStudents Assigned student info (optional)
 */
function renderSeatingChartV2(currentSeatLayout, assignedStudents) {
  // console.log(currentSeatLayout);
  // console.log(assignedStudents);
  const seatingChartDiv = document.getElementById('seatingChartHandmade');
  seatingChartDiv.innerHTML = ''; // Clear existing seating chart
  seatingChartDiv.insertAdjacentHTML(
    'beforeend',
    (() => {
      const availableSeatCoordinates = [];
      currentSeatLayout.forEach((row, rowIndex) => {
        row.forEach((seat, colIndex) => {
          if (seat === 1) {
            availableSeatCoordinates.push({ row: rowIndex, col: colIndex });
          }
        });
      });
      const retHtmlStrArray = [];
      const seatCellWidth = Math.floor(12 / configDb.SEAT_POSITION_MATRIX[0].length);
      currentSeatLayout.forEach((rowArray, rowIndex) => {
        if (rowArray.includes(1)) {
          retHtmlStrArray.push(
            `<div class="row py-1">${(() => {
              const retHtmlStrArray2 = [];
              rowArray.forEach((seatStatus, colIndex) => {
                if (seatStatus) {
                  const currentSeatOrderIndex = availableSeatCoordinates.findIndex(
                    (coord) => coord.row === rowIndex && coord.col === colIndex,
                  );
                  const currentSeatCoord = availableSeatCoordinates[currentSeatOrderIndex];
                  if (assignedStudents) {
                    if (currentSeatOrderIndex !== -1 && currentSeatOrderIndex < assignedStudents.length) {
                      const student = assignedStudents[currentSeatOrderIndex];
                      retHtmlStrArray2.push(
                        `<div class="col-${seatCellWidth} px-1"><div class="d-flex flex-column seat-cell-border" data-seat-row="${currentSeatCoord.row}" data-seat-col="${currentSeatCoord.col}" data-seat-assigned="true"><span>${student.id}</span><span class="fs-5 fw-bold">${student.name}</span><span class="text-secondary">${student.ruby}</span></div></div>`,
                      );
                    }
                  } else {
                    retHtmlStrArray2.push(
                      `<div class="col-${seatCellWidth} px-1"><div class="d-flex flex-column seat-cell-border" data-seat-row="${currentSeatCoord.row}" data-seat-col="${currentSeatCoord.col}" data-seat-assigned="false"><span>&nbsp;</span><span class="fs-5 fw-bold">&nbsp;</span><span class="text-secondary">&nbsp;</span></div></div>`,
                    );
                  }
                } else {
                  retHtmlStrArray2.push(`<div class="col-${seatCellWidth} px-1"></div>`);
                }
              });
              return retHtmlStrArray2.join('');
            })()}</div>`,
          );
        }
      });
      retHtmlStrArray.push(
        `<div class="row py-1"><div class="col-${Math.floor((seatCellWidth * configDb.SEAT_POSITION_MATRIX[0].length) / 3)} px-1"></div><div class="col-${Math.floor((seatCellWidth * configDb.SEAT_POSITION_MATRIX[0].length) / 3)} px-1"><div class="d-flex flex-column seat-cell-border"><span class="fs-5 fw-bold">${configDb.CLASS_NUMBER.grade}${configDb.CLASS_I18N.grade}${configDb.CLASS_NUMBER.class}${configDb.CLASS_I18N.class}</span></div></div><div class="col-${Math.floor((seatCellWidth * configDb.SEAT_POSITION_MATRIX[0].length) / 3)} px-1"></div></div>`,
      );
      return retHtmlStrArray.join('');
    })(),
  );
  document.getElementById('exportImageButton').disabled = !Boolean(assignedStudents);
  document.getElementById('exportJsonButton').disabled = !Boolean(assignedStudents);
}

/**
 * Main seat shuffle processing
 */
function performShuffle() {
  const topStatusMessageSpan = [...document.querySelectorAll('#topStatusMessage p span')];

  topStatusMessageSpan.forEach((el) => (el.textContent = '\u00A0'));

  document.getElementById('errorMessage').classList.add('d-none'); // Hide error messages
  const numberOfStudents = configDb.MEMBER_LIST.length;
  const numberOfAvailableSeats = countAvailableSeats(configDb.SEAT_POSITION_MATRIX);
  if (numberOfStudents !== numberOfAvailableSeats) {
    document.getElementById(
      'errorMessage',
    ).innerHTML = `Error: The number of students does not match the number of seats available. (${numberOfStudents} ≠ ${numberOfAvailableSeats})<br>Please check <span class="font-monospace">member_list.csv</span> and <span class="font-monospace">seat_position_matrix.csv</span>`;
    document.getElementById('errorMessage').classList.remove('d-none');
    renderSeatingChartV2(configDb.SEAT_POSITION_MATRIX); // Display current layout (not assigned)
    return;
  }
  temporalState.shuffledStudents = secureShuffle(configDb.MEMBER_LIST);
  // Assign shuffled students to available seats
  // (Assignments are made within the drawing function)
  renderSeatingChartV2(configDb.SEAT_POSITION_MATRIX, temporalState.shuffledStudents);
  temporalState.shuffledStudents = null;
}

async function performShuffleV3() {
  const topStatusMessageSpan = [...document.querySelectorAll('#topStatusMessage p span')];

  topStatusMessageSpan.forEach((el) => (el.textContent = '\u00A0'));

  ['shuffleStepButton', 'shuffleButton', 'resetAllSeatButton', 'exportImageButton', 'exportJsonButton'].forEach(
    (el) => (document.getElementById(el).disabled = true),
  );

  document.getElementById('errorMessage').classList.add('d-none'); // Hide error messages
  const numberOfStudents = configDb.MEMBER_LIST.length;
  const numberOfAvailableSeats = countAvailableSeats(configDb.SEAT_POSITION_MATRIX);
  if (numberOfStudents !== numberOfAvailableSeats) {
    document.getElementById(
      'errorMessage',
    ).innerHTML = `Error: The number of students does not match the number of seats available. (${numberOfStudents} ≠ ${numberOfAvailableSeats})<br>Please check <span class="font-monospace">member_list.csv</span> and <span class="font-monospace">seat_position_matrix.csv</span>`;
    document.getElementById('errorMessage').classList.remove('d-none');
    renderSeatingChartV2(configDb.SEAT_POSITION_MATRIX); // Display current layout (not assigned)
    return;
  }

  const seatingChartDiv = document.getElementById('seatingChartHandmade');
  if (temporalState.currentMemberIndex === 0) {
    renderSeatingChartV2(configDb.SEAT_POSITION_MATRIX);
  }

  topStatusMessageSpan[0].textContent = `${configDb.MEMBER_LIST[temporalState.currentMemberIndex].id} - ${configDb.MEMBER_LIST[temporalState.currentMemberIndex].name
    }`;

  const remainingSeatCoordinates = [...seatingChartDiv.querySelectorAll('div[data-seat-assigned="false"]')].map(
    (el) => ({ row: el.dataset.seatRow, col: el.dataset.seatCol }),
  );

  const pickRandomSeatCoord = () => {
    const randomBytes = new Uint32Array(1);
    const getRandomIndex = (arrayLength) => {
      window.crypto.getRandomValues(randomBytes);
      return Math.floor((randomBytes[0] / 0x100000000) * arrayLength);
    };
    return {
      coord: remainingSeatCoordinates[getRandomIndex(remainingSeatCoordinates.length)],
      randBuffer: randomBytes,
    };
  };

  const updateSeatSpanContent = {
    assign: (row, col, memberIndex) => {
      const seatDiv = seatingChartDiv.querySelector(
        `div[data-seat-row="${row}"][data-seat-col="${col}"][data-seat-assigned="false"]`,
      );
      const seatSpans = [...seatDiv.querySelectorAll('span')];
      seatSpans[0].textContent = configDb.MEMBER_LIST[memberIndex].id;
      seatSpans[1].textContent = configDb.MEMBER_LIST[memberIndex].name;
      seatSpans[2].textContent = configDb.MEMBER_LIST[memberIndex].ruby;
      seatDiv.dataset.seatAssigned = 'true';
    },
    clear: (row, col) => {
      const seatDiv = seatingChartDiv.querySelector(`div[data-seat-row="${row}"][data-seat-col="${col}"]`);
      const seatSpans = [...seatDiv.querySelectorAll('span')];
      seatSpans.forEach((el) => (el.textContent = '\u00A0'));
      seatDiv.dataset.seatAssigned = 'false';
    },
    cellBlink: async (row, col) => {
      const seatDiv = seatingChartDiv.querySelector(`div[data-seat-row="${row}"][data-seat-col="${col}"]`);
      seatDiv.classList.add('seat-cell-border-blink');
      await new Promise((resolve) => setTimeout(resolve, 3000));
      seatDiv.classList.remove('seat-cell-border-blink');
    },
  };

  document.getElementById('shuffleStepButton').innerHTML = '<span class="spinner-border spinner-border-large me-2"></span>';

  let pickedRandomSeatCoord = pickRandomSeatCoord(); // init value

  await (async () => {
    const initialDelay = configDb.DEFAULT_SHUFFLE_CONFIG.initialDelay;
    const maxDelay = configDb.DEFAULT_SHUFFLE_CONFIG.maxDelay;
    const totalIterations = configDb.DEFAULT_SHUFFLE_CONFIG.totalIterations;
    if (remainingSeatCoordinates.length === 1) {
      updateSeatSpanContent.clear(pickedRandomSeatCoord.coord.row, pickedRandomSeatCoord.coord.col);
      updateSeatSpanContent.assign(
        pickedRandomSeatCoord.coord.row,
        pickedRandomSeatCoord.coord.col,
        temporalState.currentMemberIndex,
      );
    } else {
      for (let i = 0; i < totalIterations; i++) {
        const t = i / (totalIterations - 1);
        const easedT = t * t * t; // easeInCubic
        const delay = initialDelay + (maxDelay - initialDelay) * easedT;
        // const delay = initialDelay + (i * (maxDelay - initialDelay)) / (totalIterations - 1);
        topStatusMessageSpan[1].innerHTML = `Status: Processing ... (<span class="font-monospace">Iter: ${String(
          i,
        ).padStart(String(totalIterations).length, '\u00A0')}/${String(totalIterations).padStart(
          String(totalIterations).length,
          ' ',
        )}, Wait: ${String(Math.round(delay)).padStart(String(maxDelay).length, '\u00A0')}ms, Rand: ${Array.from(
          pickedRandomSeatCoord.randBuffer,
          (n) => '0x' + ('00000000' + n.toString(16).toUpperCase()).slice(-8),
        ).join(', ')}</span>)`;
        await new Promise((resolve) => setTimeout(resolve, Math.round(delay)));
        updateSeatSpanContent.clear(pickedRandomSeatCoord.coord.row, pickedRandomSeatCoord.coord.col);
        pickedRandomSeatCoord = pickRandomSeatCoord();
        updateSeatSpanContent.assign(
          pickedRandomSeatCoord.coord.row,
          pickedRandomSeatCoord.coord.col,
          temporalState.currentMemberIndex,
        );
      }
    }
  })();

  topStatusMessageSpan[1].innerHTML = 'Status: Completed';

  document.getElementById('shuffleStepButton').innerHTML = '<span><i class="bi me-2 bi-shuffle"></i></span>Step';

  temporalState.currentMemberIndex++;
  if (temporalState.currentMemberIndex === numberOfStudents) {
    temporalState.currentMemberIndex = 0;
    document.getElementById('shuffleStepButton').disabled = true;
    document.getElementById('shuffleButton').disabled = false;
  } else {
    document.getElementById('shuffleButton').disabled = true;
    document.getElementById('shuffleStepButton').disabled = false;
  }
  ['exportImageButton', 'exportJsonButton', 'resetAllSeatButton'].forEach(
    (el) => (document.getElementById(el).disabled = false),
  );

  updateSeatSpanContent.cellBlink(pickedRandomSeatCoord.coord.row, pickedRandomSeatCoord.coord.col);

  await new Promise((resolve) => setTimeout(resolve, 1000));

  if (temporalState.currentMemberIndex > 0) {
    topStatusMessageSpan[0].textContent = `${configDb.MEMBER_LIST[temporalState.currentMemberIndex].id} - ${configDb.MEMBER_LIST[temporalState.currentMemberIndex].name}`;
    topStatusMessageSpan[1].textContent = 'Status: Waiting for user ...';
  }
}

function exportAsImage() {
  const originalTheme = document.documentElement.getAttribute('data-bs-theme');

  document.querySelector('#exportImageButton span').innerHTML = '';
  document.querySelector('#exportImageButton span').classList.add('spinner-border');
  document.querySelector('#exportImageButton span').classList.add('me-2');

  // Change style temporarily
  if (originalTheme === 'dark') document.documentElement.setAttribute('data-bs-theme', 'light');

  // Wait for DOM redraw
  requestAnimationFrame(() => {
    // Capture the entire viewport
    const seatingChartElement = document.getElementById('seatingChartHandmade');
    html2canvas(seatingChartElement, {
      scrollX: -window.scrollX,
      scrollY: -window.scrollY,
      windowWidth: seatingChartElement.scrollWidth,
      windowHeight: seatingChartElement.scrollHeight,
      scale: 3,
    })
      .then((canvas) => {
        const link = document.createElement('a');
        link.download = 'seating-chart.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
      })
      .finally(() => {
        // Restore original style
        if (originalTheme === 'dark') document.documentElement.setAttribute('data-bs-theme', originalTheme);
        document.querySelector('#exportImageButton span').innerHTML = '<i class="bi me-2 bi-image"></i>';
        document.querySelector('#exportImageButton span').classList.remove('spinner-border');
        document.querySelector('#exportImageButton span').classList.remove('me-2');
      });
  });
}

document.getElementById('exportImageButton').addEventListener('click', function () {
  exportAsImage();
});

document.getElementById('resetAllSeatButton').addEventListener('click', () => {
  renderSeatingChartV2(configDb.SEAT_POSITION_MATRIX);
  temporalState.currentMemberIndex = 0;
  document.getElementById('shuffleStepButton').disabled = false;
  document.getElementById('shuffleButton').disabled = false;
  [...document.querySelectorAll('#topStatusMessage p span')].forEach((el) => (el.textContent = '\u00A0'));
});

document.getElementById('shuffleStepButton').addEventListener('click', async () => {
  await performShuffleV3();
});

document.getElementById('shuffleButton').addEventListener('click', performShuffle);

document.addEventListener('DOMContentLoaded', async () => {
  configDb = await configDbFunc.loadDb();
  window.configDb = configDb;
  renderSeatingChartV2(configDb.SEAT_POSITION_MATRIX); // Display current layout (not assigned)
  document.querySelector('#DEBUG_configDbDiv pre code').textContent = YAML.stringify(configDb);
  ['shuffleStepButton', 'shuffleButton', 'resetAllSeatButton'].forEach(
    (el) => (document.getElementById(el).disabled = false),
  );
});
