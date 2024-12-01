const Web3 = require('web3');
const contract = require('@truffle/contract');
const votingArtifacts = require('../../build/contracts/Voting.json');
var VotingContract = contract(votingArtifacts);

window.App = {
  eventStart: function () {
    window.ethereum.request({ method: 'eth_requestAccounts' });
    VotingContract.setProvider(window.ethereum);
    VotingContract.defaults({ from: window.ethereum.selectedAddress, gas: 6654755 });

    // Load account data
    App.account = window.ethereum.selectedAddress;
    $("#accountAddress").html("Your Account: " + window.ethereum.selectedAddress);

    VotingContract.deployed().then(function (instance) {
      // Load existing campaigns
      instance.campaignCount().then(function (countCampaigns) {
        for (let i = 1; i <= countCampaigns; i++) {
          instance.getCampaign(i).then(function (data) {
            const id = data[0];
            const name = data[1];
            const startDate = new Date(data[2] * 1000).toDateString();
            const endDate = new Date(data[3] * 1000).toDateString();

            const option = `<option value="${id}">${name} (${startDate} - ${endDate})</option>`;
            $("#campaignSelect").append(option);
            const options = `<option value="${id}">${name} (${startDate} - ${endDate})</option>`;
            $("#campaignSelectTwo").append(options);
          }).catch(console.error);
        }
      }).catch(console.error);


      // Add a new candidate to a campaign
      $('#addCandidate').click(function () {
        const nameCandidate = $('#name').val();
        const partyCandidate = $('#party').val();
        const campaignId = $('#campaignSelect').val();

        if (!campaignId) {
          alert("Please select a campaign.");
          return;
        }

        instance.addCandidate(nameCandidate, partyCandidate, campaignId).then(function () {
          alert("Candidate added successfully!");
          window.location.reload();
        }).catch(console.error);
      });

      // Add a new campaign
      $('#addCampaign').click(function () {
        const name = $('#campaignName').val();
        const startDate = Date.parse($('#campaignStartDate').val()) / 1000;
        const endDate = Date.parse($('#campaignEndDate').val()) / 1000;

        instance.addCampaign(name, startDate, endDate).then(function () {
          alert("Campaign added successfully!");
          window.location.reload();
        }).catch(console.error);
      });

      // Announce results
      $('#announceResult').click( function () {
        const campaignId = $('#campaignSelectTwo').val();

        if (!campaignId) {
          alert("Please select a campaign to announce results.");
          return;
        }

        instance.getCampaignVoteCount(campaignId).then(function (totalVotes) {
          $("#result").html(`Total Votes for Campaign ${campaignId}: ${totalVotes}`);
        }).catch(console.error);
        instance.getCampaignWinner(campaignId).then(function (winner) {
          // Log winner to inspect the structure
          console.log(winner); // Add this to see what is actually returned
        
          // Assuming winner is an array, with [name, party, voteCount]
          const name = winner[0];  // Winner's name (string)
          const party = winner[1]; // Winner's party (string)
          const voteCount = winner[2]; // Winner's vote count (uint)
        
          // Update HTML with the winner details
          $("#winner").html(`
            Winner Details:
            <br>Name: ${name}
            <br>Party: ${party}
            <br>Vote Count: ${voteCount}
          `);
        }).catch(console.error);
        
        
      });
    }).catch(console.error);
  },

  loadCandidates: function () {
    const campaignId = $("#campaignSelect").val();
    if (!campaignId) {
      $("#boxCandidate").empty();
      $("#dates").text("No campaign selected");
      $("#voteButton").attr("disabled", true);
      return;
    }

    VotingContract.deployed().then(function (instance) {
      
      instance.getCampaign(campaignId).then(function (campaign) {
        const startDate = new Date(campaign[2] * 1000).toDateString();
        const endDate = new Date(campaign[3] * 1000).toDateString();
        $("#dates").text(`${startDate} - ${endDate}`);
        $("#currentCampaign").text(campaign[1]);
      }).catch(console.error);

      instance.candidateCount().then(function (count) {
        $("#boxCandidate").empty();
        for (let i = 1; i <= count; i++) {
          instance.getCandidate(i).then(function (candidate) {
            if (candidate[4] == campaignId) {
              const row = `
                <tr>
                  <td>
                    <input class="form-check-input" type="radio" name="candidate" value="${candidate[0]}" id="${candidate[0]}">
                   
                  </td>
                  <td>
                   ${candidate[1]}
                  </td>
                  <td>${candidate[2]}</td>
                  <td>${candidate[3]}</td>
                </tr>`;
              $("#boxCandidate").append(row);
            }
          }).catch(console.error);
        }
      }).catch(console.error);
    }).catch(console.error);
  },

  vote: function () {
    var candidateID = $("input[name='candidate']:checked").val();
    if (!candidateID) {
      $("#msg").html("<p>Please vote for a candidate.</p>");
      return;
    }
    VotingContract.deployed().then(function (instance) {
      instance.vote(parseInt(candidateID)).then(function () {
        $("#voteButton").attr("disabled", true);
        $("#msg").html("<p>Voted</p>");
        window.location.reload();
      }).catch(function (err) {
        console.error("ERROR! " + err.message);
      });
    }).catch(console.error);
  }
};

window.addEventListener("load", function () {
  if (typeof web3 !== "undefined") {
    console.warn("Using web3 detected from external source like Metamask");
    window.eth = new Web3(window.ethereum);
  } else {
    console.warn("No web3 detected. Falling back to http://localhost:9545.");
    window.eth = new Web3(new Web3.providers.HttpProvider("http://127.0.0.1:9545"));
  }
  window.App.eventStart();
});
