import Cube from 'cubejs';
import { validateCube } from './lib/cube';

let ready = false;
self.onmessage = (event: MessageEvent<string>) => {
  try {
    const result = validateCube(event.data);
    if (!result.ok) throw new Error(result.message);
    if (!ready) {
      self.postMessage({ type: 'status', message: 'Menyiapkan solver di perangkatmu…' });
      Cube.initSolver();
      ready = true;
    }
    self.postMessage({ type: 'status', message: 'Mencari urutan gerakan…' });
    const algorithm = result.cube.solve();
    if (!Cube.fromString(event.data).move(algorithm).isSolved()) throw new Error('Solusi belum cocok. Coba hitung ulang.');
    self.postMessage({ type: 'solution', moves: algorithm.trim() ? algorithm.trim().split(/\s+/) : [] });
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Solusi gagal dihitung. Silakan coba lagi.' });
  }
};
