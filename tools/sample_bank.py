"""Original practice passages shipped with the public app. Not taken from any exam bank."""

PASSAGE_FILLER = (
    " The clerk kept a second copy of the tide table on the shelf above the kettle, "
    "and visitors could read it without asking. "
)


def harbor_passage():
    body = (
        "<h2>Harbor Notebook</h2>"
        "<p>The town keeps a paper notebook in a shed beside the pier. "
        "Each evening the harbor clerk writes down the tide, the lamps that were lit, "
        "and whether the cedar rail was wet.</p>"
        "<p>A red lantern hangs above the shed door. It is lit before the fog bell, "
        "never after. Children are allowed to read the notebook, but they may not take it home.</p>"
        "<p>On market day the clerk adds one extra line for the number of boats that stayed overnight. "
        "That line is a count, not a list of names.</p>"
    )
    return body + "".join(f"<p>Extra note {index}.{PASSAGE_FILLER}</p>" for index in range(1, 18))


HARBOR = {
    "schemaVersion": "ReadingExamSourceV1",
    "examId": "sample-harbor",
    "meta": {
        "title": "Harbor Notebook 港湾笔记",
        "category": "P1",
        "frequency": "high",
        "questionIntroHtml": "<h3>Questions</h3>",
    },
    "passage": {"blocks": [{"blockId": "passage-main", "kind": "html", "html": harbor_passage()}]},
    "questionGroups": [
        {
            "groupId": "group-fill",
            "kind": "sentence_completion",
            "questionIds": ["q1", "q2", "q3"],
            "allowOptionReuse": False,
            "bodyHtml": """
<div class="group">
  <h4>Questions 1–3</h4>
  <p>Complete the notes. Write <strong>ONE WORD</strong> for each answer.</p>
  <ul>
    <li><strong>1</strong> The notebook is stored in a <input type="text" id="q1_input" name="q1">.</li>
    <li><strong>2</strong> A red <input type="text" id="q2_input" name="q2"> hangs above the door.</li>
    <li><strong>3</strong> The rail mentioned in the notebook is made of <input type="text" id="q3_input" name="q3">.</li>
  </ul>
</div>
""",
        },
        {
            "groupId": "group-tfng",
            "kind": "true_false_not_given",
            "questionIds": ["q4", "q5", "q6"],
            "allowOptionReuse": False,
            "bodyHtml": """
<div class="group">
  <h4>Questions 4–6</h4>
  <p>Do the following statements agree with the passage?</p>
  <p><strong>4</strong> The lantern is lit before the fog bell.</p>
  <label><input type="radio" name="q4" value="TRUE"> TRUE</label>
  <label><input type="radio" name="q4" value="FALSE"> FALSE</label>
  <label><input type="radio" name="q4" value="NOT GIVEN"> NOT GIVEN</label>
  <p><strong>5</strong> Children may take the notebook home.</p>
  <label><input type="radio" name="q5" value="TRUE"> TRUE</label>
  <label><input type="radio" name="q5" value="FALSE"> FALSE</label>
  <label><input type="radio" name="q5" value="NOT GIVEN"> NOT GIVEN</label>
  <p><strong>6</strong> The clerk is paid extra on market day.</p>
  <label><input type="radio" name="q6" value="TRUE"> TRUE</label>
  <label><input type="radio" name="q6" value="FALSE"> FALSE</label>
  <label><input type="radio" name="q6" value="NOT GIVEN"> NOT GIVEN</label>
</div>
""",
        },
    ],
    "answerKey": {"q1": "shed", "q2": "lantern", "q3": "cedar", "q4": "TRUE", "q5": "FALSE", "q6": "NOT GIVEN"},
    "questionOrder": ["q1", "q2", "q3", "q4", "q5", "q6"],
    "questionDisplayMap": {f"q{i}": str(i) for i in range(1, 7)},
}

HARBOR_EXPLANATION = {
    "schemaVersion": "ReadingExplanationV1",
    "examId": "sample-harbor",
    "meta": {"examId": "sample-harbor", "title": "Harbor Notebook 港湾笔记", "category": "P1", "noteType": "原创解析"},
    "passageNotes": [
        {"label": "Paragraph 1", "text": "原创解析：笔记放在码头边的棚屋里，记录潮汐、灯和雪松栏杆。"},
        {"label": "Paragraph 2", "text": "原创解析：红灯笼先于雾钟点亮。孩子可以读，不能把笔记带回家。"},
    ],
    "questionExplanations": [
        {
            "sectionTitle": "填空与判断",
            "mode": "per_question",
            "questionRange": {"start": 1, "end": 6},
            "items": [
                {"questionId": "q1", "questionNumber": 1, "text": "答案 shed。笔记放在 shed 里。"},
                {"questionId": "q2", "questionNumber": 2, "text": "答案 lantern。门上方挂着红灯笼。"},
                {"questionId": "q3", "questionNumber": 3, "text": "答案 cedar。栏杆是雪松做的。"},
                {"questionId": "q4", "questionNumber": 4, "text": "答案 TRUE。灯笼先于雾钟点亮。"},
                {"questionId": "q5", "questionNumber": 5, "text": "答案 FALSE。孩子不能把笔记带回家。"},
                {"questionId": "q6", "questionNumber": 6, "text": "答案 NOT GIVEN。文中没有说集市日是否加薪。"},
            ],
        }
    ],
}

LIGHTHOUSE = {
    "schemaVersion": "ReadingExamSourceV1",
    "examId": "sample-lighthouse",
    "meta": {"title": "Glass Loft 玻璃阁楼", "category": "P2", "frequency": "medium", "questionIntroHtml": "<h3>Questions</h3>"},
    "passage": {"blocks": [{"blockId": "passage-main", "kind": "html", "html":
        "<h2>Glass Loft</h2>"
        "<p><strong>A</strong> Mira keeps spare lamp wicks in a loft above the chart room.</p>"
        "<p><strong>B</strong> The pier shed stores coiled rope and a tin of chalk.</p>"
        "<p><strong>C</strong> Visitors wait on the east bench when the loft stair is closed.</p>"
        + "".join(f"<p>Margin {i}. The loft stair is narrow and counted in pairs.</p>" for i in range(1, 12))
    }]},
    "questionGroups": [
        {
            "groupId": "group-match",
            "kind": "matching",
            "questionIds": ["q1", "q2"],
            "allowOptionReuse": False,
            "bodyHtml": """
<div class="group">
  <h4>Questions 1–2</h4>
  <p>Match each note with the place. Tap a place, then tap the answer box.</p>
  <div class="question-item"><div class="match-question-item"><div class="match-dropzone" data-question="q1"></div><p><strong>1</strong> Spare lamp wicks are kept here.</p></div></div>
  <div class="question-item"><div class="match-question-item"><div class="match-dropzone" data-question="q2"></div><p><strong>2</strong> Coiled rope is stored here.</p></div></div>
  <div class="options-pool" id="place-pool"><strong>Places</strong><div class="pool-items">
    <div class="drag-item" draggable="true" data-option="loft">loft</div>
    <div class="drag-item" draggable="true" data-option="shed">shed</div>
    <div class="drag-item" draggable="true" data-option="bench">bench</div>
  </div></div>
</div>
""",
        }
    ],
    "answerKey": {"q1": "loft", "q2": "shed"},
    "questionOrder": ["q1", "q2"],
    "questionDisplayMap": {"q1": "1", "q2": "2"},
}

LIGHTHOUSE_EXPLANATION = {
    "schemaVersion": "ReadingExplanationV1",
    "examId": "sample-lighthouse",
    "meta": {"examId": "sample-lighthouse", "title": "Glass Loft 玻璃阁楼", "category": "P2", "noteType": "原创解析"},
    "passageNotes": [{"label": "Places", "text": "原创解析：灯芯在阁楼，绳子在棚屋，等候的人在东边长凳。"}],
    "questionExplanations": [{
        "sectionTitle": "配对",
        "mode": "per_question",
        "questionRange": {"start": 1, "end": 2},
        "items": [
            {"questionId": "q1", "questionNumber": 1, "text": "答案 loft。备用灯芯放在阁楼。"},
            {"questionId": "q2", "questionNumber": 2, "text": "答案 shed。绳子放在棚屋。"},
        ],
    }],
}

ORCHARD = {
    "schemaVersion": "ReadingExamSourceV1",
    "examId": "sample-orchard",
    "meta": {"title": "Orchard Bell 果园铃", "category": "P3", "frequency": "low", "questionIntroHtml": "<h3>Questions</h3>"},
    "passage": {"blocks": [{"blockId": "passage-main", "kind": "html", "html":
        "<h2>Orchard Bell</h2><p>The Saturday bell rings once for pears and twice for apples. "
        "It never rings for rain. The bell rope is kept in a blue tin.</p>"
    }]},
    "questionGroups": [{
        "groupId": "group-choice",
        "kind": "multiple_choice",
        "questionIds": ["q1", "q2"],
        "allowOptionReuse": False,
        "bodyHtml": """
<div class="group">
  <h4>Questions 1–2</h4>
  <p><strong>1</strong> How does the bell mark pears?</p>
  <label><input type="radio" name="q1" value="A"> A once</label>
  <label><input type="radio" name="q1" value="B"> B twice</label>
  <label><input type="radio" name="q1" value="C"> C it does not ring</label>
  <p><strong>2</strong> Where is the rope kept?</p>
  <label><input type="radio" name="q2" value="A"> A in a blue tin</label>
  <label><input type="radio" name="q2" value="B"> B on the pier</label>
  <label><input type="radio" name="q2" value="C"> C in the loft</label>
</div>
""",
    }],
    "answerKey": {"q1": "A", "q2": "A"},
    "questionOrder": ["q1", "q2"],
    "questionDisplayMap": {"q1": "1", "q2": "2"},
}

ORCHARD_EXPLANATION = {
    "schemaVersion": "ReadingExplanationV1",
    "examId": "sample-orchard",
    "meta": {"examId": "sample-orchard", "title": "Orchard Bell 果园铃", "category": "P3", "noteType": "原创解析"},
    "passageNotes": [{"label": "Bell", "text": "原创解析：梨响一次，苹果响两次，绳子在蓝铁盒里。"}],
    "questionExplanations": [{
        "sectionTitle": "选择",
        "mode": "per_question",
        "questionRange": {"start": 1, "end": 2},
        "items": [
            {"questionId": "q1", "questionNumber": 1, "text": "答案 A。梨只响一次。"},
            {"questionId": "q2", "questionNumber": 2, "text": "答案 A。绳子放在蓝铁盒。"},
        ],
    }],
}

EXAMS = [HARBOR, LIGHTHOUSE, ORCHARD]
EXPLANATIONS = [HARBOR_EXPLANATION, LIGHTHOUSE_EXPLANATION, ORCHARD_EXPLANATION]

CATALOG = {
    "sample-harbor": {"title": "Harbor Notebook 港湾笔记", "category": "P1", "frequency": "高频", "difficultyScore": 2, "questionTypes": ["sentence-completion", "true-false-not-given"]},
    "sample-lighthouse": {"title": "Glass Loft 玻璃阁楼", "category": "P2", "frequency": "次高频", "difficultyScore": 3, "questionTypes": ["matching-features"]},
    "sample-orchard": {"title": "Orchard Bell 果园铃", "category": "P3", "frequency": "低频", "difficultyScore": 3, "questionTypes": ["multiple-choice"]},
}
