
export function emit(parser, event, data) {
  parser[event] && parser[event](data);
}
