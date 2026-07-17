const QUESTION_START_RE = /^\s*(\d+)\s*[.)]?\s*(\S.*)$/u
const CHOICE_RE = /^\s*([ก-ฮa-z])\s*[.)]\s*(\S.*)$/iu
const ANSWER_RE = /^\s*(เฉลย|คำตอบ|ตอบ|answer)(?:\s*[:：]\s*|\s+)(\S.*)\s*$/iu
const WRITTEN_ANSWER_RE = /^\s*(?:คำตอบ|answer)\s*[:：]\s*(\S.*)\s*$/iu
const CHOICE_LABEL_RE = /^[ก-ฮa-z]$/iu

function normalizeLabel(label) {
  return label.trim().toLocaleLowerCase('th-TH')
}

function parseAnswerLabels(value) {
  const normalized = value
    .replace(/และ/gu, ' ')
    .replace(/\band\b/giu, ' ')
    .replace(/[,，、;；/|&+]/gu, ' ')
    .trim()

  if (!normalized) return null

  const labels = normalized.split(/\s+/u).map(normalizeLabel)
  return labels.every((label) => CHOICE_LABEL_RE.test(label)) ? labels : null
}

function finalizeQuestion(current, questions, errors) {
  if (!current) return

  const issuePrefix = `ข้อ ${current.sourceNumber}`
  if (!current.questionText.trim()) {
    errors.push(`${issuePrefix}: ไม่พบข้อความคำถาม`)
    return
  }

  if (current.choices.length === 0) {
    if (!current.writtenAnswer) {
      errors.push(`${issuePrefix}: ไม่พบตัวเลือกหรือบรรทัด "คำตอบ: ..."`)
      return
    }

    questions.push({
      sourceNumber: current.sourceNumber,
      question_text: current.questionText.trim(),
      question_type: 'written',
      choices: null,
      correct_text: current.writtenAnswer.trim(),
      points: 1,
    })
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
  if (current.answerError) {
    errors.push(`${issuePrefix}: ${current.answerError}`)
    return
  }
  if (!current.answerLabels?.length) {
    errors.push(`${issuePrefix}: ไม่พบบรรทัดเฉลย`)
    return
  }
  if (new Set(current.answerLabels).size !== current.answerLabels.length) {
    errors.push(`${issuePrefix}: มีตัวเลือกในเฉลยซ้ำกัน`)
    return
  }
  if (!current.answerLabels.every((answerLabel) => labels.includes(answerLabel))) {
    errors.push(`${issuePrefix}: เฉลยไม่ตรงกับตัวเลือก`)
    return
  }

  questions.push({
    sourceNumber: current.sourceNumber,
    question_text: current.questionText.trim(),
    question_type: current.answerLabels.length > 1 ? 'multiple_choice' : 'single_choice',
    choices: current.choices.map((choice) => ({
      text: choice.text.trim(),
      is_correct: current.answerLabels.includes(choice.label),
    })),
    correctLabel: current.answerLabels.join(', '),
    correctLabels: current.answerLabels,
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
        answerLabels: null,
        answerError: null,
        writtenAnswer: null,
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

    const writtenAnswerMatch = line.match(WRITTEN_ANSWER_RE)
    if (current.choices.length === 0 && writtenAnswerMatch) {
      current.writtenAnswer = writtenAnswerMatch[1].trim()
      continue
    }

    const answerMatch = line.match(ANSWER_RE)
    if (answerMatch) {
      const answerLabels = parseAnswerLabels(answerMatch[2])
      if (answerLabels) {
        current.answerLabels = answerLabels
        current.answerError = null
      } else {
        current.answerLabels = null
        current.answerError = 'รูปแบบเฉลยไม่ถูกต้อง ใช้เช่น "เฉลย ก" หรือ "เฉลย ก, ค"'
      }
      continue
    }

    if (current.choices.length === 0 && !current.writtenAnswer) {
      current.questionText += ` ${line}`
    } else if (
      current.choices.length > 0 &&
      !current.answerLabels &&
      !current.answerError
    ) {
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
  return parsedQuestions.map(
    ({
      sourceNumber: _sourceNumber,
      correctLabel: _correctLabel,
      correctLabels: _correctLabels,
      ...question
    }) => question
  )
}
