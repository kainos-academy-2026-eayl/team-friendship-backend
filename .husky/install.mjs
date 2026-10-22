if (
  process.env.NODE_ENV === 'production' ||
  process.env.CI ||
  process.env.HUSKY === '0'
) {
  process.exit(0);
}

const { default: husky } = await import('husky');
const error = husky();
if (error) {
  throw new Error(error);
}
