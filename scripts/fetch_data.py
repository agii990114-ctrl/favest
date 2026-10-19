"""샘플 시세 스냅샷 생성 스크립트 (일회성 실행).

FinanceDataReader로 국내 대형주의 최근 125거래일(약 6개월) 종가·거래량을 받아
src/data/stocks.json 으로 저장한다. 앱은 이 JSON만 읽으므로 배포 후 외부 API에 의존하지 않는다.
"""
import json
from pathlib import Path

import FinanceDataReader as fdr

SECTORS = {
    "semiconductor": ("반도체·IT", [
        ("005930", "삼성전자"), ("000660", "SK하이닉스"), ("009150", "삼성전기"),
        ("042700", "한미반도체"), ("011070", "LG이노텍"), ("018260", "삼성에스디에스"),
    ]),
    "battery": ("2차전지·에너지", [
        ("373220", "LG에너지솔루션"), ("006400", "삼성SDI"), ("005490", "POSCO홀딩스"),
        ("247540", "에코프로비엠"), ("003670", "포스코퓨처엠"), ("015760", "한국전력"),
    ]),
    "bio": ("바이오·헬스케어", [
        ("207940", "삼성바이오로직스"), ("068270", "셀트리온"), ("000100", "유한양행"),
        ("128940", "한미약품"), ("326030", "SK바이오팜"), ("196170", "알테오젠"),
    ]),
    "auto": ("자동차·모빌리티", [
        ("005380", "현대차"), ("000270", "기아"), ("012330", "현대모비스"),
        ("204320", "HL만도"), ("161390", "한국타이어앤테크놀로지"),
    ]),
    "finance": ("금융", [
        ("105560", "KB금융"), ("055550", "신한지주"), ("086790", "하나금융지주"),
        ("316140", "우리금융지주"), ("032830", "삼성생명"), ("138040", "메리츠금융지주"),
    ]),
    "platform": ("인터넷·플랫폼", [
        ("035420", "NAVER"), ("035720", "카카오"), ("323410", "카카오뱅크"),
    ]),
    "game": ("게임·엔터", [
        ("259960", "크래프톤"), ("036570", "엔씨소프트"), ("251270", "넷마블"),
        ("352820", "하이브"), ("035900", "JYP Ent."),
    ]),
    "consumer": ("소비재·유통", [
        ("090430", "아모레퍼시픽"), ("097950", "CJ제일제당"), ("271560", "오리온"),
        ("004370", "농심"), ("139480", "이마트"), ("051900", "LG생활건강"),
    ]),
}

DAYS = 125
START = "2026-02-01"
END = "2026-10-16"


def main() -> None:
    stocks = []
    for sector_id, (sector_name, items) in SECTORS.items():
        for code, name in items:
            try:
                df = fdr.DataReader(code, START, END)
            except Exception as exc:  # 개별 종목 실패는 건너뜀
                print(f"skip {code} {name}: {exc}")
                continue
            df = df[df["Volume"] > 0].tail(DAYS)
            if len(df) < DAYS:
                print(f"skip {code} {name}: only {len(df)} rows")
                continue
            stocks.append({
                "code": code,
                "name": name,
                "sector": sector_id,
                "dates": [d.strftime("%Y-%m-%d") for d in df.index],
                "close": [int(v) for v in df["Close"]],
                "volume": [int(v) for v in df["Volume"]],
            })
            print(f"ok   {code} {name} {len(df)}")

    out = {
        "asOf": stocks[0]["dates"][-1],
        "source": "FinanceDataReader(KRX 일별 시세) 스냅샷, 과제용 샘플",
        "sectors": {sid: name for sid, (name, _) in SECTORS.items()},
        "stocks": stocks,
    }
    path = Path(__file__).resolve().parent.parent / "src" / "data" / "stocks.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"saved {len(stocks)} stocks -> {path}")


if __name__ == "__main__":
    main()
