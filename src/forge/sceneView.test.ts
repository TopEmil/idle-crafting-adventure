import { describe, expect, it } from 'vitest';
import type { SceneView } from './sceneView';

describe('SceneView', () => {
  it('supports mine and forge', () => {
    const views: SceneView[] = ['mine', 'forge'];
    expect(views).toHaveLength(2);
  });
});
