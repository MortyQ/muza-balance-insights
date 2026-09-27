/** «1 подключение», «2 подключения», «5 подключений». */
export function connectionsCount(n: number): string {
  const tens = n % 100;
  const ones = n % 10;
  const word = tens >= 11 && tens <= 14 ? 'подключений' : ones === 1 ? 'подключение' : ones >= 2 && ones <= 4 ? 'подключения' : 'подключений';
  return `${n} ${word}`;
}
