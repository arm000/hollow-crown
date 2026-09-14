import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { Projectile } from "./Projectile";

describe("Projectile", () => {
  it("starts inactive", () => {
    const projectile = new Projectile();
    expect(projectile.isActive).toBe(false);
  });

  it("becomes active the moment it's fired, and inactive again once it finishes", () => {
    const projectile = new Projectile();
    projectile.fire(new THREE.Vector3(0, 0, 0), new THREE.Vector3(4, 0, 0), 0xff6a2a);
    expect(projectile.isActive).toBe(true);

    projectile.update(10); // well past its travel duration
    expect(projectile.isActive).toBe(false);
  });

  it("interpolates from the fired position to the target, arriving exactly at the end", () => {
    const projectile = new Projectile();
    const from = new THREE.Vector3(0, 1, 0);
    const to = new THREE.Vector3(10, 1, 0);
    projectile.fire(from, to, 0xffffff);

    expect(projectile.position().x).toBe(0); // hasn't moved yet
    projectile.update(0.1);
    const mid = projectile.position();
    expect(mid.x).toBeGreaterThan(0);
    expect(mid.x).toBeLessThan(10);

    projectile.update(10);
    expect(projectile.position()).toEqual(to);
  });

  it("carries whatever color fire() was given", () => {
    const projectile = new Projectile();
    projectile.fire(new THREE.Vector3(), new THREE.Vector3(1, 0, 0), 0x8ad8ff);
    expect(projectile.color).toBe(0x8ad8ff);
  });

  it("cancel ends an in-flight bolt immediately", () => {
    const projectile = new Projectile();
    projectile.fire(new THREE.Vector3(), new THREE.Vector3(1, 0, 0), 0xffffff);
    expect(projectile.isActive).toBe(true);

    projectile.cancel();

    expect(projectile.isActive).toBe(false);
  });

  it("firing again restarts the flight rather than queuing -- only one is ever in flight", () => {
    const projectile = new Projectile();
    projectile.fire(new THREE.Vector3(), new THREE.Vector3(10, 0, 0), 0xff0000);
    projectile.update(0.2); // partway through the first flight

    projectile.fire(new THREE.Vector3(5, 0, 0), new THREE.Vector3(5, 0, 10), 0x00ff00);

    expect(projectile.isActive).toBe(true);
    expect(projectile.color).toBe(0x00ff00);
    expect(projectile.position()).toEqual(new THREE.Vector3(5, 0, 0)); // back at the new flight's start
  });
});
