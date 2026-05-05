function launchOptions(overrides = {}) {
  const ciArgs = process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox'] : [];
  return {
    headless: 'new',
    ...overrides,
    args: [...ciArgs, ...(overrides.args || [])],
  };
}

module.exports = { launchOptions };
