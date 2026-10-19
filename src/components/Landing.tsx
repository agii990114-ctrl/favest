import './Landing.css'

/** 로그인 전 첫 화면. 상단과 하단의 로그인 버튼을 누르면 로그인 화면으로 넘어간다. */
export default function Landing({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-nav-in">
          <a className="lp-logo" href="#lp-top" aria-label="FAVEST 처음으로">
            <img src="/brand/favest-logo-indigo.png" alt="FAVEST" />
          </a>
          <div className="lp-nav-act">
            <button className="lp-pill dark" onClick={onLogin}>로그인</button>
          </div>
        </div>
      </header>

      <section className="lp-hero" id="lp-top">
        <p className="lp-eyebrow">내 계좌 점검 · 종목 추천 서비스</p>
        <h1>
          내 계좌를 점검하고,<br />
          내 조건에 맞는 종목을<br />
          근거와 함께 받아 보세요.
        </h1>
        <p className="lp-sub">예측이 아니라 과거 수치로 설명합니다. 한 번 받고 끝나는 추천이 아니라, 열어 볼 때마다 달라지는 계좌 점검입니다.</p>
        <button className="lp-pill blue big" onClick={onLogin}>지금 로그인하기</button>
        <a className="lp-down" href="#lp-problem" aria-label="아래로 이동">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9l7 7 7-7" /></svg>
        </a>
      </section>

      <section className="lp-problem" id="lp-problem">
        <div className="lp-wrap lp-split">
          <div className="lp-copy">
            <h2>추천만 받아서는<br />내 계좌가 나아지지 않습니다.</h2>
            <p>보유 종목이 한 업종에 쏠려 있어도 모르고 지나치기 쉽습니다. FAVEST는 먼저 내 계좌를 점검하고, 비중이 낮은 업종에서 보완할 종목을 골라 드립니다.</p>
          </div>
          <div className="lp-mock" aria-hidden="true">
            <div className="lp-mock-card">
              <div className="lp-mock-head"><b>업종 비중</b><span>기준일 2026-10-16</span></div>
              <div className="lp-bar">
                <i style={{ width: '45%', background: '#1652e0' }} />
                <i style={{ width: '29%', background: '#8f5a00' }} />
                <i style={{ width: '22%', background: '#34507a' }} />
                <i style={{ width: '4%', background: '#007a6e' }} />
              </div>
              <ul className="lp-legend">
                <li><span style={{ background: '#1652e0' }} />반도체·IT<em>45%</em></li>
                <li><span style={{ background: '#8f5a00' }} />금융<em>29%</em></li>
                <li><span style={{ background: '#34507a' }} />자동차·모빌리티<em>22%</em></li>
              </ul>
              <p className="lp-warn">반도체·IT 비중이 높습니다. 비중이 낮은 업종에서 보완할 종목을 골라 봤습니다.</p>
            </div>
            <div className="lp-mock-chip">추천 업종 · 2차전지·에너지</div>
          </div>
        </div>
      </section>

      <section className="lp-why" id="lp-why">
        <div className="lp-wrap">
          <h2 className="lp-center">왜 FAVEST일까요?</h2>
          <div className="lp-cards">
            <article className="lp-card c1">
              <div className="lp-card-head">
                <Icon kind="check" />
                <h3>내 계좌 점검</h3>
              </div>
              <p>업종 쏠림과 위험 신호를 근거 수치와 함께 보여 줍니다.</p>
            </article>
            <article className="lp-card c2">
              <div className="lp-card-head">
                <Icon kind="sliders" />
                <h3>성향별 추천</h3>
              </div>
              <p>투자 성향 5단계와 투자 기간에 맞춰 점수의 비중이 달라집니다.</p>
            </article>
            <article className="lp-card c3">
              <div className="lp-card-head">
                <Icon kind="list" />
                <h3>이유를 숫자로</h3>
              </div>
              <p>왜 이 종목인지, 어떤 점을 조심해야 하는지 과거 수치로 설명합니다.</p>
            </article>
            <article className="lp-card c4">
              <div className="lp-card-head">
                <Icon kind="news" />
                <h3>뉴스 요약</h3>
              </div>
              <p>종목 관련 기사 제목을 AI가 세 줄로 요약해 줍니다.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="lp-steps" id="lp-steps">
        <div className="lp-wrap">
          <h2 className="lp-center">로그인부터 보완 종목까지,<br />네 단계로 끝납니다.</h2>
          <ol className="lp-stepgrid">
            <li><b>1</b><h3>로그인</h3><p>이 브라우저에 계정과 조건을 저장합니다.</p></li>
            <li><b>2</b><h3>조건 입력</h3><p>설문, 직접 설정, 거래내역 파일, 계좌 연결 중에서 고릅니다.</p></li>
            <li><b>3</b><h3>내 계좌 점검</h3><p>보유 종목과 업종 비중을 확인합니다.</p></li>
            <li><b>4</b><h3>보완 종목 추천</h3><p>조건은 팝업에서 바로 바꿀 수 있습니다.</p></li>
          </ol>
        </div>
      </section>

      <section className="lp-cta">
        <div className="lp-wrap lp-cta-in">
          <h2>준비되셨나요?<br />로그인하고 내 계좌부터 점검해 보세요.</h2>
          <button className="lp-pill white" onClick={onLogin}>로그인하기</button>
        </div>
      </section>

      <footer className="lp-foot">
        <div className="lp-wrap lp-foot-in">
          <img src="/brand/favest-logo-indigo.png" alt="FAVEST" />
          <p>본 서비스는 과거 수치를 정리한 참고 정보이며 투자 권유가 아닙니다. 시세는 2026-10-16 기준 샘플 데이터입니다.</p>
          <p className="lp-foot-sub">새움소프트 미니 과제 · FAVEST</p>
        </div>
      </footer>
    </div>
  )
}

function Icon({ kind }: { kind: 'check' | 'sliders' | 'list' | 'news' }) {
  const paths: Record<string, string> = {
    check: 'M8 17l4 4 8-9',
    sliders: 'M8 10h16M8 16h16M8 22h16',
    list: 'M10 10h12M10 16h12M10 22h7',
    news: 'M9 9h14v14H9zM13 13h6M13 17h6M13 21h3',
  }
  return (
    <span className="lp-ico" aria-hidden="true">
      <svg viewBox="0 0 32 32"><path d={paths[kind]} /></svg>
    </span>
  )
}
