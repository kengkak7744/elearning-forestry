const QUESTION_START_RE = /^\s*(\d+)\s*[.)]?\s*(\S.*)$/u
const CHOICE_RE = /^\s*([ก-ฮa-z])\s*[.)]\s*(\S.*)$/iu
const ANSWER_RE = /^\s*(?:เฉลย|คำตอบ|ตอบ|answer)\s*[:：]?\s*([ก-ฮa-z])\s*$/iu

function normalizeLabel(label) {
  return label.trim().toLocaleLowerCase('th-TH')
}

function finalizeQuestion(current, questions, errors) {
  if (!current) return

  const issuePrefix = `ข้อ ${current.sourceNumber}`
  if (!current.questionText.trim()) {
    errors.push(`${issuePrefix}: ไม่พบข้อความคำถาม`)
    return
  }
  if (current.choices.length < 2) {
    errors.push(`${issuePrefix}: ต้องมีตัวเลือกอย่างน้อย 2 ตัวเลือก`)
    return
  }

  const labels = current.choices.map((choice) => choice.label)
  if (new Set(labels).size !== labels.length) {
    errors.push(`${issuePrefix}: มีตัวเลือกซ้ำกัน`)
    return
  }
  if (!current.answerLabel) {
    errors.push(`${issuePrefix}: ไม่พบบรรทัดเฉลย`)
    return
  }
  if (!labels.includes(current.answerLabel)) {
    errors.push(`${issuePrefix}: เฉลยไม่ตรงกับตัวเลือก`)
    return
  }

  questions.push({
    sourceNumber: current.sourceNumber,
    question_text: current.questionText.trim(),
    question_type: 'single_choice',
    choices: current.choices.map((choice) => ({
      text: choice.text.trim(),
      is_correct: choice.label === current.answerLabel,
    })),
    correctLabel: current.answerLabel,
    points: 1,
  })
}

export function parseThaiQuestions(input) {
  const questions = []
  const errors = []
  let current = null

  for (const rawLine of input.replace(/\r\n?/g, '\n').split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    const questionMatch = line.match(QUESTION_START_RE)
    if (questionMatch) {
      finalizeQuestion(current, questions, errors)
      current = {
        sourceNumber: questionMatch[1],
        questionText: questionMatch[2],
        choices: [],
        answerLabel: null,
      }
      continue
    }

    if (!current) {
      errors.push(`ไม่รู้จักข้อความก่อนข้อแรก: ${line}`)
      continue
    }

    const choiceMatch = line.match(CHOICE_RE)
    if (choiceMatch) {
      current.choices.push({
        label: normalizeLabel(choiceMatch[1]),
        text: choiceMatch[2],
      })
      continue
    }

    const answerMatch = line.match(ANSWER_RE)
    if (answerMatch) {
      current.answerLabel = normalizeLabel(answerMatch[1])
      continue
    }

    if (current.choices.length === 0) {
      current.questionText += ` ${line}`
    } else if (!current.answerLabel) {
      const lastChoice = current.choices[current.choices.length - 1]
      lastChoice.text += ` ${line}`
    } else {
      errors.push(`ข้อ ${current.sourceNumber}: ไม่รู้จักบรรทัด ${line}`)
    }
  }

  finalizeQuestion(current, questions, errors)
  if (!input.trim()) errors.push('กรุณาวางข้อความคำถาม')
  return { questions, errors }
}

export function toBulkQuestionPayload(parsedQuestions) {
  return parsedQuestions.map(({ sourceNumber: _sourceNumber, correctLabel: _correctLabel, ...question }) => question)
}
