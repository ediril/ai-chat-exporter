const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const VERSION_PATTERN = /^[1-9][0-9]*\.(0|[1-9][0-9]*)\.[1-9][0-9]*$/;

// <major>.<work-day>.<daily-commit>, advanced from the starting version in
// <projectDir>/version.json along the first-parent commits that touch projectDir.
module.exports = function gitVersion(projectDir) {
  const { version, commit } = JSON.parse(fs.readFileSync(path.join(projectDir, 'version.json'), 'utf8'));
  if (
    typeof version !== 'string' ||
    !VERSION_PATTERN.test(version) ||
    typeof commit !== 'string' ||
    !/^[0-9a-f]{40}$/.test(commit)
  ) {
    throw new Error('version.json requires a valid starting version and a full commit SHA');
  }
  const [major, workDay, increment] = version.split('.').map(Number);

  const log = execFileSync('git', ['log', '--first-parent', '--format=%H %cI', 'HEAD', '--', '.'], {
    cwd: projectDir,
    encoding: 'utf8'
  });
  const dates = [];
  let found = false;
  for (const line of log.trim().split('\n')) {
    const [sha, timestamp] = line.split(' ');
    dates.push(timestamp.slice(0, 10));
    if (sha === commit) {
      found = true;
      break;
    }
  }
  if (!found) {
    throw new Error('version baseline is missing from history; fetch the full history or correct version.json');
  }
  if (dates.some((date, i) => i > 0 && date > dates[i - 1])) {
    throw new Error("commit dates go backwards in the version baseline's history");
  }

  let dailyCommits = dates.filter(date => date === dates[0]).length;
  if (dates[0] === dates[dates.length - 1]) {
    dailyCommits += increment - 1;
  }
  return `${major}.${workDay + new Set(dates).size - 1}.${dailyCommits}`;
};
