import assert from 'node:assert/strict'
import test from 'node:test'

import { parseThaiQuestions, toBulkQuestionPayload } from './parseThaiQuestions.js'

const FIRE_QUESTIONS = `1 ข้อใดคือองค์ประกอบของ "สามเหลี่ยมไฟ"

ก. เชื้อเพลิง น้ำ และลม

ข. เชื้อเพลิง ความร้อน และออกซิเจน

ค. ความร้อน น้ำ และออกซิเจน

ง. เชื้อเพลิง ควัน และออกซิเจน
เฉลย ข
2 ข้อใดเป็นคำนิยามของไฟป่าตามประเทศไทย

ก. ไฟที่เกิดจากฟ้าผ่าเท่านั้น

ข. ไฟที่เกิดในสวนเกษตร

ค. ไฟที่เกิดจากสาเหตุใดก็ตามและลุกลามโดยปราศจากการควบคุม

ง. ไฟที่เกิดในเมือง
เฉลย ค
3 เชื้อเพลิงของไฟป่า ได้แก่ข้อใด

ก. น้ำและดิน

ข. ใบไม้แห้ง กิ่งไม้ หญ้า และตอไม้

ค. หินและทราย

ง. อากาศและน้ำ
เฉลย ข
4 ข้อใดไม่ใช่ชนิดของไฟป่า

ก. ไฟใต้ดิน

ข. ไฟผิวดิน

ค. ไฟเรือนยอด

ง. ไฟอาคาร
เฉลย ง
5 ไฟป่าชนิดใดพบมากที่สุดในประเทศไทย

ก. ไฟใต้ดิน

ข. ไฟเรือนยอด

ค. ไฟผิวดิน

ง. ไฟใต้ทะเล
เฉลย ค`

test('parses the numbered Thai fire-question format', () => {
  const parsed = parseThaiQuestions(FIRE_QUESTIONS)

  assert.deepEqual(parsed.errors, [])
  assert.equal(parsed.questions.length, 5)
  assert.deepEqual(
    parsed.questions.map((question) => question.sourceNumber),
    ['1', '2', '3', '4', '5']
  )
  assert.ok(parsed.questions.every((question) => question.choices.length === 4))
  assert.equal(
    parsed.questions[0].question_text,
    'ข้อใดคือองค์ประกอบของ "สามเหลี่ยมไฟ"'
  )
  assert.deepEqual(
    parsed.questions.map((question) => question.correctLabel),
    ['ข', 'ค', 'ข', 'ง', 'ค']
  )
  assert.deepEqual(
    parsed.questions.map((question) =>
      question.choices.findIndex((choice) => choice.is_correct)
    ),
    [1, 2, 1, 3, 2]
  )
})

test('creates a clean bulk API payload from parsed questions', () => {
  const parsed = parseThaiQuestions(FIRE_QUESTIONS)
  const payload = toBulkQuestionPayload(parsed.questions)

  assert.equal(payload.length, 5)
  assert.ok(payload.every((question) => question.question_type === 'single_choice'))
  assert.ok(payload.every((question) => question.points === 1))
  assert.ok(payload.every((question) => !('sourceNumber' in question)))
  assert.ok(payload.every((question) => !('correctLabel' in question)))
  assert.equal(payload[0].choices[1].is_correct, true)
})

test('marks Thai choice ก at index 0 as correct', () => {
  const parsed = parseThaiQuestions(`1 ข้อใดเป็นคำตอบที่ถูกต้อง

ก. คำตอบที่ถูกต้อง

ข. ตัวเลือกที่สอง

ค. ตัวเลือกที่สาม

ง. ตัวเลือกที่สี่
เฉลย ก`)

  assert.deepEqual(parsed.errors, [])
  assert.equal(parsed.questions.length, 1)
  assert.equal(parsed.questions[0].correctLabel, 'ก')
  assert.equal(
    parsed.questions[0].choices.findIndex((choice) => choice.is_correct),
    0
  )

  const [payload] = toBulkQuestionPayload(parsed.questions)
  assert.equal(payload.choices[0].is_correct, true)
  assert.ok(payload.choices.slice(1).every((choice) => !choice.is_correct))
})
