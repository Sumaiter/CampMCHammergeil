import { describe, expect, it } from 'vitest'
import { buildInsertAdminSql } from './admin-sql'

describe('buildInsertAdminSql', () => {
  it('erzeugt das INSERT für einen Admin', () => {
    expect(buildInsertAdminSql('boss', 'pbkdf2$1$a$b')).toBe(
      "INSERT INTO users (username, password_hash, is_admin) VALUES ('boss', 'pbkdf2$1$a$b', 1);",
    )
  })

  it('verdoppelt Hochkommas im Hash', () => {
    expect(buildInsertAdminSql('boss', "a'b")).toContain("'a''b'")
  })

  it.each(['bo ss', 'ab', "bo'ss"])('lehnt ungültigen Namen %j ab', (name) => {
    expect(() => buildInsertAdminSql(name, 'x')).toThrow()
  })
})
