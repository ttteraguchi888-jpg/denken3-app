// =================================================================
// 電験三種（理論・機械）学習苦手克服アプリ メインプログラム (app.js)
// すべての変数、定数、関数には日本語で詳細な説明コメントを記述しています。
// =================================================================

// -----------------------------------------------------------------
// 状態管理用オブジェクト (現在の学習ステートを保持)
// -----------------------------------------------------------------

// 現在アクティブな画面ID ('home', 'quiz', 'dashboard')
let currentView = 'home';

// 現在選択されている学習モード ('theory', 'machine', 'weakness')
let currentMode = '';

// 現在の出題リスト (選択されたモードに応じた問題の配列)
let activeQuestions = [];

// 現在表示している問題のインデックス (0から開始)
let currentQuestionIndex = 0;

// 現在のセッションにおける正解数
let sessionCorrectCount = 0;

// 現在表示している問題オブジェクトの参照
let currentQuestion = null;

// ユーザーがすでに回答を選択したかどうかのフラグ
let hasAnswered = false;

// -----------------------------------------------------------------
// ローカルストレージキー定義 (学習データの永続化用)
// -----------------------------------------------------------------

// 苦手問題のオブジェクトリストを格納するキー
// データ構造: [ { id: "theory_q1", date: "2026/05/23 15:53:11" }, ... ]
const LOCAL_STORAGE_WEAK_KEY = 'denken_weak_list';
// 累計解答数を格納するキー
const LOCAL_STORAGE_TOTAL_ANSWERS = 'denken_total_answers';
// 累計正答数を格納するキー
const LOCAL_STORAGE_CORRECT_ANSWERS = 'denken_correct_answers';

// -----------------------------------------------------------------
// アプリ初期化処理 (ロード時に実行)
// -----------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
    // ローカルストレージの初期設定値を確認・作成
    if (!localStorage.getItem(LOCAL_STORAGE_WEAK_KEY)) {
        localStorage.setItem(LOCAL_STORAGE_WEAK_KEY, JSON.stringify([]));
    }
    if (!localStorage.getItem(LOCAL_STORAGE_TOTAL_ANSWERS)) {
        localStorage.setItem(LOCAL_STORAGE_TOTAL_ANSWERS, '0');
    }
    if (!localStorage.getItem(LOCAL_STORAGE_CORRECT_ANSWERS)) {
        localStorage.setItem(LOCAL_STORAGE_CORRECT_ANSWERS, '0');
    }

    // ダッシュボードの統計を最新化
    updateDashboardStats();
    // 苦手克服ボタンの活性・非活性状態を更新
    updateWeaknessBtnState();
});

// -----------------------------------------------------------------
// 苦手リストデータの正規化関数 (データの旧形式から新形式への移行処理)
// -----------------------------------------------------------------
function getWeakListNormalized() {
    // ローカルストレージからデータをロード
    const rawData = localStorage.getItem(LOCAL_STORAGE_WEAK_KEY);
    if (!rawData) return [];
    
    try {
        // JSON形式からパース
        const parsed = JSON.parse(rawData);
        if (!Array.isArray(parsed)) return [];
        
        // 各要素をオブジェクト型に統一する
        return parsed.map(item => {
            if (typeof item === 'string') {
                // 旧バージョンで単なるID文字列配列だった場合の救済措置
                return { id: item, date: '記録なし' };
            }
            if (item && typeof item === 'object' && item.id) {
                // 新形式 { id, date } の場合はそのまま返す
                return { id: item.id, date: item.date || '日時不明' };
            }
            return null;
        }).filter(item => item !== null);
    } catch (e) {
        // エラー発生時は安全のため空配列を返す
        return [];
    }
}

// -----------------------------------------------------------------
// 日時フォーマット取得関数 (現在日時を日本語表示しやすい形で生成)
// -----------------------------------------------------------------
function getCurrentDateTimeString() {
    // 現在のシステム日付オブジェクトを取得
    const now = new Date();
    
    // 各パーツを取得し、1桁の場合は先頭を0で埋める
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const date = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    
    // YYYY/MM/DD HH:mm:ss 形式で整形して返す
    return `${year}/${month}/${date} ${hours}:${minutes}:${seconds}`;
}

// -----------------------------------------------------------------
// 画面切り替えロジック
// -----------------------------------------------------------------
function switchView(viewId) {
    // すべてのセクション要素を取得
    const sections = document.querySelectorAll('.view-section');
    // すべてのナビゲーションボタンを取得
    const navButtons = document.querySelectorAll('.nav-btn');

    // 対象のセクションをアクティブにし、他を非表示にする
    sections.forEach(section => {
        if (section.id === `${viewId}-view`) {
            section.classList.add('active');
        } else {
            section.classList.remove('active');
        }
    });

    // ナビゲーションのボタンのスタイルを更新
    navButtons.forEach(btn => {
        if (btn.id === `nav-${viewId}`) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // 現在の画面IDを更新
    currentView = viewId;

    // ダッシュボードに切り替えた場合はデータを最新に更新する
    if (viewId === 'dashboard') {
        updateDashboardStats();
        renderWeaknessList();
    }
}

// -----------------------------------------------------------------
// 苦手克服ボタンの状態制御 (苦手問題がない場合は無効化風にする)
// -----------------------------------------------------------------
function updateWeaknessBtnState() {
    // 正規化された苦手リストをロード
    const weakList = getWeakListNormalized();
    // ボタンのDOM要素を取得
    const weaknessBtn = document.getElementById('weakness-btn');
    
    if (weakList.length === 0) {
        // 苦手問題がない場合は少し薄暗く表示
        weaknessBtn.style.opacity = '0.5';
        weaknessBtn.innerText = '苦手なし（召喚不可）';
    } else {
        weaknessBtn.style.opacity = '1.0';
        weaknessBtn.innerText = 'リベンジ開始';
    }
}

// -----------------------------------------------------------------
// 学習セッションの開始 (理論・機械)
// -----------------------------------------------------------------
function startLearning(subject) {
    // モードを設定 ('theory' または 'machine')
    currentMode = subject;
    
    // 全問題データから、選択された科目の問題だけをフィルタリング
    activeQuestions = denkenQuestions.filter(q => q.subject === subject);

    // 問題が見つからない場合の安全策
    if (activeQuestions.length === 0) {
        alert('対象の問題が見つかりません。');
        return;
    }

    // 問題順をランダムにシャッフル (毎回新鮮な問題演習にするため)
    activeQuestions.sort(() => Math.random() - 0.5);

    // インデックス等を初期化
    currentQuestionIndex = 0;
    sessionCorrectCount = 0;

    // 画面をクイズ画面に切り替え
    switchView('quiz');
    // クイズUIのヘッダーテキストを設定
    document.getElementById('current-mode-label').innerText = subject === 'theory' ? '理論 討伐モード' : '機械 討伐モード';
    
    // 最初の問題を表示
    showQuestion();
}

// -----------------------------------------------------------------
// 苦手克服モードの開始
// -----------------------------------------------------------------
function startWeaknessMode() {
    // 正規化された苦手問題リストを取得
    const weakList = getWeakListNormalized();

    // 苦手問題が1つもない場合は、警告を出して処理を中断
    if (weakList.length === 0) {
        alert('現在、苦手問題はありません。通常モードで間違えた問題がここに蓄積されます！');
        return;
    }

    // モードを苦手克服モードに設定
    currentMode = 'weakness';
    
    // 苦手リストのID配列だけを取り出す
    const weakIds = weakList.map(item => item.id);
    
    // 全問題データから、苦手リストに含まれるIDの問題のみを抽出
    activeQuestions = denkenQuestions.filter(q => weakIds.includes(q.id));

    // 問題順をシャッフル
    activeQuestions.sort(() => Math.random() - 0.5);

    // インデックス等を初期化
    currentQuestionIndex = 0;
    sessionCorrectCount = 0;

    // クイズ画面に切り替え
    switchView('quiz');
    // ヘッダーテキストを設定
    document.getElementById('current-mode-label').innerText = '苦手克服 (リベンジ)';
    
    // 最初の問題を表示
    showQuestion();
}

// -----------------------------------------------------------------
// 問題の描画処理
// -----------------------------------------------------------------
function showQuestion() {
    // 回答済みフラグをリセット
    hasAnswered = false;
    
    // 現在の問題オブジェクトをセット
    currentQuestion = activeQuestions[currentQuestionIndex];

    // 進行状況の表示を更新 (例: 1 / 3)
    document.getElementById('quiz-progress-label').innerText = `${currentQuestionIndex + 1} / ${activeQuestions.length}`;
    
    // 苦手蓄積数をリアルタイムに更新
    const weakList = getWeakListNormalized();
    document.getElementById('quiz-weak-count').innerText = weakList.length;

    // メタタグ（科目、分野、難易度）のセット
    document.getElementById('tag-subject').innerText = currentQuestion.subject === 'theory' ? '理論' : '機械';
    document.getElementById('tag-category').innerText = currentQuestion.category;
    document.getElementById('tag-difficulty').innerText = currentQuestion.difficulty;

    // 問題文を設定
    document.getElementById('question-text').innerText = currentQuestion.question;

    // 解説カードを非表示にする
    document.getElementById('explanation-card').style.display = 'none';

    // 選択肢コンテナを取得し、初期化
    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';

    // 選択肢ボタンを動的に生成
    currentQuestion.options.forEach((optionText, index) => {
        // ボタン要素を作成
        const btn = document.createElement('button');
        btn.className = 'option-button';
        btn.onclick = () => selectOption(index);

        // 選択肢番号用のスパン
        const numSpan = document.createElement('span');
        numSpan.className = 'option-num';
        numSpan.innerText = `(${index + 1})`;

        // 選択肢テキスト用のスパン
        const textSpan = document.createElement('span');
        textSpan.innerText = optionText;

        // ボタンに要素を追加
        btn.appendChild(numSpan);
        btn.appendChild(textSpan);
        // コンテナに追加
        optionsContainer.appendChild(btn);
    });
}

// -----------------------------------------------------------------
// 選択肢クリック時の判定処理
// -----------------------------------------------------------------
function selectOption(selectedIndex) {
    // 既に回答済みの場合は多重処理を防ぐ
    if (hasAnswered) return;
    hasAnswered = true;

    // 正解インデックスを取得
    const correctIndex = currentQuestion.correctIndex;
    // 正解判定
    const isCorrect = (selectedIndex === correctIndex);

    // 統計データ（ローカルストレージ）の更新
    let totalAnswers = parseInt(localStorage.getItem(LOCAL_STORAGE_TOTAL_ANSWERS)) || 0;
    let correctAnswers = parseInt(localStorage.getItem(LOCAL_STORAGE_CORRECT_ANSWERS)) || 0;
    
    totalAnswers++;
    if (isCorrect) {
        correctAnswers++;
        sessionCorrectCount++;
    }
    
    localStorage.setItem(LOCAL_STORAGE_TOTAL_ANSWERS, totalAnswers.toString());
    localStorage.setItem(LOCAL_STORAGE_CORRECT_ANSWERS, correctAnswers.toString());

    // 苦手リスト（ローカルストレージ）の更新
    let weakList = getWeakListNormalized();
    
    if (isCorrect) {
        // 正解した場合: もし苦手リストにこの問題が入っていれば削除する (克服成功！)
        weakList = weakList.filter(item => item.id !== currentQuestion.id);
    } else {
        // 間違えた場合: すでに苦手リストにあれば解答日付を最新に更新し、なければ新規追加
        const existingIndex = weakList.findIndex(item => item.id === currentQuestion.id);
        const currentDateTime = getCurrentDateTimeString(); // 解答日時の取得
        
        if (existingIndex !== -1) {
            // 既に存在する場合は日付を更新
            weakList[existingIndex].date = currentDateTime;
        } else {
            // 新規追加
            weakList.push({
                id: currentQuestion.id,
                date: currentDateTime
            });
        }
    }
    localStorage.setItem(LOCAL_STORAGE_WEAK_KEY, JSON.stringify(weakList));

    // ボタンのスタイル更新
    const buttons = document.querySelectorAll('.option-button');
    buttons.forEach((btn, idx) => {
        // 全ての選択肢ボタンをクリック不可にする
        btn.classList.add('disabled');
        
        if (idx === correctIndex) {
            // 正解のボタンはゴールド（BABYMETAL風アクセント）で光らせる
            btn.classList.add('correct');
        } else if (idx === selectedIndex && !isCorrect) {
            // ユーザーが選択して間違えたボタンは赤く表示
            btn.classList.add('wrong');
        }
    });

    // 解説カードに情報をセットして表示
    showExplanation(isCorrect);
    // 苦手克服ボタンの状態を更新
    updateWeaknessBtnState();
}

// -----------------------------------------------------------------
// 解説カードの表示
// -----------------------------------------------------------------
function showExplanation(isCorrect) {
    // 解説用DOM要素の取得
    const explanationCard = document.getElementById('explanation-card');
    const resultBanner = document.getElementById('result-banner');
    const formulaText = document.getElementById('formula-text');
    const techExpText = document.getElementById('tech-explanation-text');
    const analogyTitle = document.getElementById('analogy-title');
    const analogyExplanationText = document.getElementById('analogy-explanation-text');
    const nextBtn = document.getElementById('next-question-btn');

    // 正誤結果のバナー表示 (BABYMETALリスペクトの演出文)
    if (isCorrect) {
        resultBanner.className = 'result-banner banner-correct';
        resultBanner.innerText = '🔥 討伐成功 (CORRECT) 🔥';
    } else {
        resultBanner.className = 'result-banner banner-wrong';
        resultBanner.innerText = '⚡ 討伐失敗 (DEATH !!) ⚡';
    }

    // 各種解説テキストをセット
    formulaText.innerText = currentQuestion.formula || "公式定義なし";
    techExpText.innerText = currentQuestion.explanation;
    
    // 日常の例え解説のタイトルと本文をセット
    analogyTitle.innerText = `💡 日常の例え: ${currentQuestion.category}の直感理解`;
    analogyExplanationText.innerText = currentQuestion.analogy;

    // 「次の問題」ボタンの文言調整 (最後の問題の場合は「討伐完了」にする)
    if (currentQuestionIndex === activeQuestions.length - 1) {
        nextBtn.innerText = '討伐結果を確認する';
        nextBtn.className = 'btn btn-gold';
    } else {
        nextBtn.innerText = '次の問題へ';
        nextBtn.className = 'btn btn-primary';
    }

    // アニメーションを伴って解説を表示
    explanationCard.style.display = 'block';
}

// -----------------------------------------------------------------
// 次の問題への遷移処理
// -----------------------------------------------------------------
function nextQuestion() {
    if (currentQuestionIndex < activeQuestions.length - 1) {
        // 次の問題がある場合はインデックスを進めて表示
        currentQuestionIndex++;
        showQuestion();
    } else {
        // 全問終了した場合は結果をアラートし、ホームかダッシュボードに戻る
        alert(`討伐セッションが完了しました！\n今回の結果: ${activeQuestions.length}問中 ${sessionCorrectCount}問正解！`);
        // 苦手克服モードだった場合はダッシュボードに戻るのが自然
        if (currentMode === 'weakness') {
            switchView('dashboard');
        } else {
            switchView('home');
        }
    }
}

// -----------------------------------------------------------------
// クイズの中断処理
// -----------------------------------------------------------------
function quitQuiz() {
    if (confirm('現在の演習セッションを中断してホームに戻りますか？')) {
        switchView('home');
    }
}

// -----------------------------------------------------------------
// ダッシュボード統計データの更新 ＆ 苦手な傾向分析の集計とレンダリング
// -----------------------------------------------------------------
function updateDashboardStats() {
    // 各統計値をローカルストレージから取得
    const totalAnswers = parseInt(localStorage.getItem(LOCAL_STORAGE_TOTAL_ANSWERS)) || 0;
    const correctAnswers = parseInt(localStorage.getItem(LOCAL_STORAGE_CORRECT_ANSWERS)) || 0;
    const weakList = getWeakListNormalized(); // 正規化された苦手リストの取得

    // 正答率の計算
    let accuracy = 0;
    if (totalAnswers > 0) {
        accuracy = Math.round((correctAnswers / totalAnswers) * 100);
    }

    // ダッシュボードUI要素に反映
    document.getElementById('stats-total-answers').innerText = totalAnswers;
    document.getElementById('stats-weak-count').innerText = weakList.length;
    document.getElementById('stats-accuracy').innerText = `${accuracy}%`;

    // -------------------------------------------------------------
    // 【追加機能】苦手な傾向分析 (分野別の集計および可視化)
    // -------------------------------------------------------------
    const trendContainer = document.getElementById('weakness-trend-container');
    trendContainer.innerHTML = ''; // 一度コンテナを空にする

    if (weakList.length === 0) {
        // 苦手問題がゼロの場合のメッセージ
        trendContainer.innerHTML = '<div style="color: var(--color-text-muted); font-size: 1rem; text-align: center; padding: 1.5rem 0;">傾向データなし（現在苦手問題ゼロ）</div>';
        return;
    }

    // 分野（カテゴリ）ごとの間違えた回数を集計するオブジェクト
    // 構造例: { "静電気": { count: 2, subject: "theory" } }
    const categoryCounts = {};

    weakList.forEach(item => {
        // 問題IDから元の問題データを検索
        const q = denkenQuestions.find(dq => dq.id === item.id);
        if (q) {
            // カテゴリが未登録なら初期化
            if (!categoryCounts[q.category]) {
                categoryCounts[q.category] = {
                    count: 0,
                    subject: q.subject
                };
            }
            // 間違い数をカウントアップ
            categoryCounts[q.category].count++;
        }
    });

    // 集計した連想配列を配列に変換し、間違い数の多い順（降順）でソート
    const sortedTrends = Object.keys(categoryCounts).map(cat => {
        return {
            category: cat,
            count: categoryCounts[cat].count,
            subject: categoryCounts[cat].subject
        };
    }).sort((a, b) => b.count - a.count);

    // 最大の間違い数を算出 (これを100%幅としてスケールさせる)
    const maxCount = sortedTrends[0].count;

    // 動的に各分野の傾向バーを生成して追加
    sortedTrends.forEach(trend => {
        // スケール幅のパーセント計算
        const percent = Math.round((trend.count / maxCount) * 100);
        // 科目の日本語表示
        const subjectLabel = trend.subject === 'theory' ? '理論' : '機械';
        // 科目に応じたCSSクラス (赤かゴールドか)
        const subjectClass = trend.subject === 'theory' ? 'trend-subject-theory' : 'trend-subject-machine';

        // ゲージバー用のHTMLブロックを作成
        const trendItemDiv = document.createElement('div');
        trendItemDiv.className = 'trend-item';
        trendItemDiv.innerHTML = `
            <div class="trend-info">
                <span><span class="${subjectClass}">[${subjectLabel}]</span> ${trend.category}</span>
                <span style="color: var(--color-gold); font-weight: 900;">${trend.count}問</span>
            </div>
            <div class="trend-bar-container">
                <div class="trend-bar-fill" style="width: ${percent}%;"></div>
            </div>
        `;
        
        // コンテナへ追加
        trendContainer.appendChild(trendItemDiv);
    });
}

// -----------------------------------------------------------------
// ダッシュボード内の苦手問題リストの描画 (回答した日にちを追加表示)
// -----------------------------------------------------------------
function renderWeaknessList() {
    // 正規化された苦手リストをロード
    const weakList = getWeakListNormalized();
    // リストのコンテナDOMを取得
    const container = document.getElementById('weakness-list-container');
    
    // コンテナをクリア
    container.innerHTML = '';

    // 苦手問題が1つもない場合の表示
    if (weakList.length === 0) {
        container.innerHTML = `
            <div class="no-weakness-msg">
                現在、深淵に苦手問題は存在しません。<br>
                通常演習で間違えた問題がここに自動的に記録されます。
            </div>
        `;
        return;
    }

    // 苦手IDリストをループして問題を表示
    weakList.forEach(item => {
        // 問題IDから元の問題データを検索
        const q = denkenQuestions.find(dq => dq.id === item.id);
        
        // データが見つからない場合の安全処理
        if (!q) return;

        // 苦手アイテムのラッパー要素を作成
        const itemDiv = document.createElement('div');
        itemDiv.className = 'weakness-item';

        // 科目ラベルの判定 (理論＝赤、機械＝金)
        const subjectName = q.subject === 'theory' ? '理論' : '機械';
        const subjectStyle = q.subject === 'theory' 
            ? 'color: var(--color-red); font-weight: bold;' 
            : 'color: var(--color-gold); font-weight: bold;';

        // アイテムの中身HTMLを構築 (回答した日にちの表示を追加！)
        itemDiv.innerHTML = `
            <div class="weakness-item-info">
                <div class="weakness-item-title" title="${q.question}">${q.question}</div>
                <div class="weakness-item-sub">
                    <span style="${subjectStyle}">[${subjectName}]</span> ${q.category} | 難易度: ${q.difficulty}
                    <div style="margin-top: 0.4rem; color: #a0a0a5; font-size: 0.85rem; font-weight: 700;">
                        📅 解答日: ${item.date}
                    </div>
                </div>
            </div>
            <button class="btn btn-secondary" style="font-size: 0.8rem; padding: 0.4rem 1rem;" onclick="startSingleWeaknessQuiz('${q.id}')">
                再挑戦
            </button>
        `;

        // コンテナにアイテムを追加
        container.appendChild(itemDiv);
    });
}

// -----------------------------------------------------------------
// 特定の苦手問題単体に再挑戦する処理
// -----------------------------------------------------------------
function startSingleWeaknessQuiz(questionId) {
    // 該当の問題を探す
    const targetQ = denkenQuestions.find(q => q.id === questionId);
    if (!targetQ) return;

    // 演習モードを苦手克服に設定
    currentMode = 'weakness';
    // 出題リストに対象の問題1問だけをセット
    activeQuestions = [targetQ];
    
    // インデックス等を初期化
    currentQuestionIndex = 0;
    sessionCorrectCount = 0;

    // クイズ画面へ遷移
    switchView('quiz');
    // タイトルの設定
    document.getElementById('current-mode-label').innerText = '苦手討伐（リベンジ）';
    
    // 問題を表示
    showQuestion();
}

// -----------------------------------------------------------------
// 統計データと苦手リストの初期化処理
// -----------------------------------------------------------------
function clearWeaknessData() {
    if (confirm('これまでの解答履歴および苦手登録リストをすべてリセットして初期化しますか？\nこの操作は取り消せません。')) {
        // ローカルストレージ内のデータをクリア
        localStorage.setItem(LOCAL_STORAGE_WEAK_KEY, JSON.stringify([]));
        localStorage.setItem(LOCAL_STORAGE_TOTAL_ANSWERS, '0');
        localStorage.setItem(LOCAL_STORAGE_CORRECT_ANSWERS, '0');

        // ダッシュボードと表示の更新
        updateDashboardStats();
        renderWeaknessList();
        updateWeaknessBtnState();
        
        alert('初期化が完了しました。');
    }
}
